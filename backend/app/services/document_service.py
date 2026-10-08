"""Document management and processing service."""

import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status, UploadFile, BackgroundTasks
from sqlalchemy.orm import Session
from app.repositories.course_repository import CourseRepository
from app.repositories.document_repository import DocumentRepository
from app.schemas.document import (
    DocumentResponse,
    DocumentDetailResponse,
    DocumentChunkResponse,
)
from app.processing.pipeline import ProcessingPipeline
from app.processing.extractor import MultimodalExtractor
from app.models.document import Document, DocumentChunk

logger = logging.getLogger(__name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    ".pdf": "pdf",
    ".pptx": "pptx",
    ".mp4": "video",
    ".webm": "video",
    ".mp3": "audio",
    ".wav": "audio",
    ".txt": "text",
    ".vtt": "video",
    ".srt": "video",
}


class DocumentService:
    """Manages document upload intake, pipeline orchestration, and demo material seeding."""

    @staticmethod
    def _verify_course_ownership(db: Session, course_id: str, user_id: str):
        """Ensure course exists and belongs to the authenticated user."""
        course = CourseRepository.get_by_id(db, course_id, user_id=user_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course workspace not found or you do not have permission.",
            )
        return course

    @classmethod
    def list_documents(cls, db: Session, course_id: str, user_id: str) -> List[DocumentResponse]:
        """List all documents uploaded to a course workspace."""
        cls._verify_course_ownership(db, course_id, user_id)
        docs = DocumentRepository.list_by_course(db, course_id)
        results = []
        for d in docs:
            results.append(
                DocumentResponse(
                    id=d.id,
                    course_id=d.course_id,
                    filename=d.filename,
                    file_type=d.file_type,
                    file_size=d.file_size,
                    processing_status=d.processing_status,
                    processing_error=d.processing_error,
                    chunks_count=len(d.chunks),
                    created_at=d.created_at,
                    updated_at=d.updated_at,
                )
            )
        return results

    @classmethod
    def get_document_detail(
        cls, db: Session, course_id: str, document_id: str, user_id: str
    ) -> DocumentDetailResponse:
        """Retrieve document along with its extracted semantic chunks and citations."""
        cls._verify_course_ownership(db, course_id, user_id)
        doc = DocumentRepository.get_by_id(db, document_id, course_id=course_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )

        chunks = [DocumentChunkResponse.model_validate(c) for c in doc.chunks]
        return DocumentDetailResponse(
            id=doc.id,
            course_id=doc.course_id,
            filename=doc.filename,
            file_type=doc.file_type,
            file_size=doc.file_size,
            processing_status=doc.processing_status,
            processing_error=doc.processing_error,
            chunks_count=len(chunks),
            created_at=doc.created_at,
            updated_at=doc.updated_at,
            chunks=chunks,
        )

    @classmethod
    def _run_background_pipeline(
        cls, course_id: str, doc_id: str, file_bytes: bytes, course_topics: List[str]
    ) -> None:
        """Background worker thread/task for heavy document parsing and embedding generation."""
        from app.database import SessionLocal
        bg_db = SessionLocal()
        try:
            doc = DocumentRepository.get_by_id(bg_db, doc_id, course_id=course_id)
            if not doc:
                return
            ProcessingPipeline.execute(
                db=bg_db,
                document=doc,
                file_bytes=file_bytes,
                course_topics=course_topics,
            )
            logger.info(f"Background processing completed for document {doc_id}")
        except Exception as e:
            logger.error(f"Background processing failed for document {doc_id}: {e}")
            try:
                doc = DocumentRepository.get_by_id(bg_db, doc_id, course_id=course_id)
                if doc:
                    doc.processing_status = "FAILED"
                    doc.processing_error = str(e)
                    bg_db.commit()
            except Exception:
                pass
        finally:
            bg_db.close()

    @classmethod
    def process_upload(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        file: UploadFile,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> DocumentDetailResponse:
        """Handle multipart file upload, validate format, and trigger processing pipeline."""
        course = cls._verify_course_ownership(db, course_id, user_id)
        course_topics = [t.name for t in course.topics]

        filename = file.filename or "uploaded_file"
        _, ext = os.path.splitext(filename)
        ext_lower = ext.lower()

        if ext_lower not in ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(ALLOWED_EXTENSIONS.keys())
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{ext_lower}'. Allowed extensions: {allowed_list}",
            )

        file_type = ALLOWED_EXTENSIONS[ext_lower]

        try:
            file_bytes = file.file.read()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read uploaded file: {e}",
            )

        if len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )

        # Create record in DB
        storage_url = f"uploads/{course_id}/{filename}"
        doc = DocumentRepository.create(
            db=db,
            course_id=course_id,
            filename=filename,
            file_type=file_type,
            storage_url=storage_url,
            file_size=len(file_bytes),
        )

        # If background tasks requested, schedule asynchronously
        if background_tasks is not None:
            doc.processing_status = "PROCESSING"
            db.commit()
            db.refresh(doc)
            background_tasks.add_task(
                cls._run_background_pipeline,
                course_id=course_id,
                doc_id=doc.id,
                file_bytes=file_bytes,
                course_topics=course_topics,
            )
            return DocumentDetailResponse(
                id=doc.id,
                course_id=doc.course_id,
                filename=doc.filename,
                file_type=doc.file_type,
                file_size=doc.file_size,
                processing_status="PROCESSING",
                processing_error=None,
                chunks_count=0,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
                chunks=[],
            )

        # Execute processing pipeline synchronously
        processed_doc = ProcessingPipeline.execute(
            db=db,
            document=doc,
            file_bytes=file_bytes,
            course_topics=course_topics,
        )

        chunks = [DocumentChunkResponse.model_validate(c) for c in processed_doc.chunks]
        return DocumentDetailResponse(
            id=processed_doc.id,
            course_id=processed_doc.course_id,
            filename=processed_doc.filename,
            file_type=processed_doc.file_type,
            file_size=processed_doc.file_size,
            processing_status=processed_doc.processing_status,
            processing_error=processed_doc.processing_error,
            chunks_count=len(chunks),
            created_at=processed_doc.created_at,
            updated_at=processed_doc.updated_at,
            chunks=chunks,
        )

    @classmethod
    async def process_youtube_ingest(
        cls,
        db: Session,
        course_id: str,
        user_id: str,
        url: str,
        custom_title: Optional[str] = None,
        manual_transcript: Optional[str] = None,
    ) -> DocumentDetailResponse:
        """Fetch YouTube video transcript or process pasted transcript, chunk semantics, and embed in knowledge base."""
        course = cls._verify_course_ownership(db, course_id, user_id)
        course_topics = [t.name for t in course.topics]

        try:
            if manual_transcript and manual_transcript.strip():
                logger.info(f"Processing user-pasted lecture transcript for course {course_id} (url={url})")
                video_title, video_id, extracted_units = await MultimodalExtractor.extract_manual_transcript(
                    raw_text=manual_transcript.strip(),
                    url=url,
                    custom_title=custom_title,
                )
            else:
                video_title, video_id, extracted_units = await MultimodalExtractor.extract_youtube(
                    url=url, custom_title=custom_title
                )
        except Exception as e:
            logger.error(f"YouTube ingestion failed for url {url}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to ingest YouTube video: {str(e)}",
            )

        if not extracted_units:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No transcript snippets could be extracted from this YouTube video. Captions or transcripts may be disabled.",
            )

        doc_filename = f"YouTube: {video_title}"[:180]
        total_size = sum(len(u.get("content", "")) for u in extracted_units)
        storage_url = f"https://www.youtube.com/watch?v={video_id}"

        # Create document record
        doc = DocumentRepository.create(
            db=db,
            course_id=course_id,
            filename=doc_filename,
            file_type="video",
            storage_url=storage_url,
            file_size=total_size,
        )

        # Process extracted units directly through chunking, embedding, topic extraction, and AI study notes
        processed_doc = ProcessingPipeline.execute_extracted_units(
            db=db,
            document=doc,
            extracted_units=extracted_units,
            course_topics=course_topics,
        )

        chunks = [DocumentChunkResponse.model_validate(c) for c in processed_doc.chunks]
        return DocumentDetailResponse(
            id=processed_doc.id,
            course_id=processed_doc.course_id,
            filename=processed_doc.filename,
            file_type=processed_doc.file_type,
            file_size=processed_doc.file_size,
            processing_status=processed_doc.processing_status,
            processing_error=processed_doc.processing_error,
            chunks_count=len(chunks),
            created_at=processed_doc.created_at,
            updated_at=processed_doc.updated_at,
            chunks=chunks,
        )

    @classmethod
    def delete_document(cls, db: Session, course_id: str, document_id: str, user_id: str) -> None:
        """Remove document and cascading chunks."""
        cls._verify_course_ownership(db, course_id, user_id)
        doc = DocumentRepository.get_by_id(db, document_id, course_id=course_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found.",
            )
        DocumentRepository.delete(db, doc)

    @classmethod
    async def synthesize_live_materials(
        cls, db: Session, course_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Synthesize topics, BKT mastery, flashcards, and assessments from uploaded course documents."""
        from app.services.synthesis_service import SynthesisService
        return await SynthesisService.synthesize_workspace(db=db, course_id=course_id, user_id=user_id)

    @classmethod
    def seed_demo_materials(cls, db: Session, course_id: str, user_id: str) -> List[DocumentResponse]:
        """
        Seed canonical multimodal study materials directly into the course knowledge base:
        1. PDF Textbook: Chapter 4 on Decision Trees & Entropy (Page 42 citations)
        2. PPTX Slides: Lecture 5 on Ensembles & Random Forest (Slide 18 citations)
        3. Video Transcript: Lecture 5 on Entropy & Information Gain (18:20-20:05 timestamps)
        Only allowed for the canonical demo course, and never when custom materials already exist.
        """
        course = cls._verify_course_ownership(db, course_id, user_id)

        existing = DocumentRepository.list_by_course(db, course_id)
        if any(d.filename == "ML_Textbook_Chapter4_DecisionTrees.pdf" for d in existing):
            return cls.list_documents(db, course_id, user_id)

        # Protection: If course already has documents, do not pollute with ML demo materials
        if len(existing) > 0:
            logger.info(f"Course '{course.name}' already has {len(existing)} uploaded documents. Skipping ML demo seed.")
            return cls.list_documents(db, course_id, user_id)

        # 1. PDF Textbook Material
        pdf_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="ML_Textbook_Chapter4_DecisionTrees.pdf",
            file_type="pdf",
            storage_url=f"demo/{course.id}/ML_Textbook_Chapter4_DecisionTrees.pdf",
            file_size=1428000,
        )
        pdf_doc.processing_status = "COMPLETED"

        pdf_chunks = [
            (
                "Entropy is a fundamental measure of the amount of uncertainty or impurity in a set of training examples. "
                "In Information Theory, the Shannon entropy H(S) of a sample collection S is computed as: "
                "H(S) = - sum(p_i * log2(p_i)), where p_i is the proportion of examples belonging to target class i. "
                "When a subset is completely homogeneous (all positive or all negative examples), its entropy equals 0. "
                "When positive and negative examples are evenly distributed, entropy achieves its maximum value of 1.0.",
                42, None, None, None, "Decision Trees"
            ),
            (
                "Information Gain (IG) measures the expected reduction in entropy achieved by partitioning instances according to an attribute A. "
                "The mathematical formulation is Gain(S, A) = Entropy(S) - sum(|S_v| / |S| * Entropy(S_v)), "
                "where v ranges over all possible values of attribute A. In algorithms like ID3 and C4.5, the attribute with the maximum Information Gain "
                "is selected as the decision node for the current split.",
                43, None, None, None, "Decision Trees"
            ),
            (
                "Overfitting in Decision Trees occurs when a tree is grown until each leaf node contains purely homogeneous samples. "
                "Such trees fit noise and idiosyncratic outliers in the training set. Techniques to mitigate overfitting include pre-pruning "
                "(stopping tree growth early based on depth or minimum sample split) and post-pruning (converting branches into leaf nodes using validation sets).",
                44, None, None, None, "Decision Trees"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(pdf_chunks):
            db.add(DocumentChunk(
                document_id=pdf_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        # 2. PPTX Slides Material
        pptx_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="ML_Lecture05_Ensembles_RandomForest.pptx",
            file_type="pptx",
            storage_url=f"demo/{course.id}/ML_Lecture05_Ensembles_RandomForest.pptx",
            file_size=2840000,
        )
        pptx_doc.processing_status = "COMPLETED"

        pptx_chunks = [
            (
                "Lecture 5: Ensemble Learning & Random Forests.\n"
                "Why ensembles? Individual decision trees suffer from high variance and sensitivity to training data fluctuations. "
                "By combining the predictions of multiple diverse estimators, ensemble models substantially reduce variance without increasing bias.",
                None, 18, None, None, "Random Forest"
            ),
            (
                "Random Forest Architecture & Bagging:\n"
                "1. Bootstrap Aggregation: Draw N random bootstrap samples with replacement from the dataset.\n"
                "2. Random Feature Subspace: At each node split, consider only a random subset of m features (typically sqrt(p)).\n"
                "3. Aggregation: Aggregate predictions across B trees via majority voting (classification) or mean averaging (regression).",
                None, 19, None, None, "Random Forest"
            ),
            (
                "Out-of-Bag (OOB) Evaluation:\n"
                "Because each tree is trained on ~63.2% of the original data, roughly 36.8% of instances are left out (Out-of-Bag). "
                "OOB error serves as an internal cross-validation estimate, eliminating the absolute necessity for a separate validation set.",
                None, 20, None, None, "Random Forest"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(pptx_chunks):
            db.add(DocumentChunk(
                document_id=pptx_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        # 3. Video Lecture Material
        video_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="ML_Lecture05_Entropy_Video_Transcript.mp4",
            file_type="video",
            storage_url=f"demo/{course.id}/ML_Lecture05_Entropy_Video_Transcript.mp4",
            file_size=15400000,
        )
        video_doc.processing_status = "COMPLETED"

        video_chunks = [
            (
                "Professor: 'Let's clarify a very common misconception about Entropy. "
                "Students frequently confuse entropy with the number of features or dimensions in a dataset. "
                "Entropy has nothing to do with how many columns you have. "
                "Entropy specifically quantifies the unpredictability of the TARGET labels. "
                "If you have 1,000 features, but all samples belong to Class A, your entropy is exactly zero.'",
                None, None, "18:20", "20:05", "Decision Trees"
            ),
            (
                "Professor: 'Now look at Information Gain. When we test a split on feature X, "
                "we calculate the weighted average of the child node entropies and subtract that from the parent node entropy. "
                "The attribute that creates the greatest drop in disorder is chosen first. "
                "Notice how this naturally generates shallower, more interpretable decision trees.'",
                None, None, "20:06", "22:45", "Decision Trees"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(video_chunks):
            db.add(DocumentChunk(
                document_id=video_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        db.commit()
        logger.info(f"Seeded 3 multimodal demo materials with citations into course {course.id}")
        return cls.list_documents(db, course_id, user_id)

    @classmethod
    def seed_deep_learning_materials(cls, db: Session, course_id: str, user_id: str) -> List[DocumentResponse]:
        """
        Seed comprehensive multimodal Deep Learning study materials directly into the course:
        1. PDF Textbook: Neural Networks, Activation Functions & Backpropagation
        2. PPTX Slides: Convolutional Neural Networks (CNNs) & Computer Vision
        3. Video Transcript: Transformers, Self-Attention & Foundation Models
        4. Study Guide: Optimizers (Adam, SGD) & Regularization (Dropout, BatchNorm)
        """
        course = cls._verify_course_ownership(db, course_id, user_id)

        existing = DocumentRepository.list_by_course(db, course_id)
        if any(d.filename == "DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf" for d in existing):
            return cls.list_documents(db, course_id, user_id)

        # 1. PDF Textbook Material
        pdf_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
            file_type="pdf",
            storage_url=f"deep_learning/{course.id}/DL_Textbook_Chapter01_Neural_Networks_and_Backprop.pdf",
            file_size=2150000,
        )
        pdf_doc.processing_status = "COMPLETED"

        pdf_chunks = [
            (
                "Artificial Neurons and Non-Linear Activation Functions: An Artificial Neuron computes a linear combination of its inputs z = sum(w_i * x_i) + b and applies an activation function f(z). Without non-linear activation functions such as ReLU (Rectified Linear Unit, f(x) = max(0, x)) or GELU, stacking multiple hidden layers simply collapses mathematically into a single linear transformation. Non-linear activations empower deep neural networks to learn intricate, highly complex non-linear decision boundaries according to the Universal Approximation Theorem.",
                15, None, None, None, "Artificial Neural Networks & Perceptrons"
            ),
            (
                "The Mechanics of Backpropagation and the Chain Rule: Training a neural network requires adjusting every weight to minimize a loss function L (such as Binary Cross-Entropy or Categorical Cross-Entropy). Through the calculus chain rule, the gradient of the loss with respect to any weight w_ij is computed by propagating error sensitivities backwards from the output layer to the input layer: dL/dw = dL/da * da/dz * dz/dw. Every weight is then updated via gradient descent: w := w - alpha * (dL/dw), where alpha is the learning rate.",
                28, None, None, None, "Loss Functions & Backpropagation"
            ),
            (
                "Vanishing and Exploding Gradients: During backpropagation across very deep architectures, multiplying many derivative terms smaller than 1.0 (such as with Sigmoid or Tanh activations) causes gradients to decay exponentially toward zero, preventing earlier layers from learning. Conversely, unscaled weights can cause gradients to explode to infinity. Modern architectures solve this using ReLU activations, He/Xavier weight initialization, and Residual skip connections.",
                34, None, None, None, "Loss Functions & Backpropagation"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(pdf_chunks):
            db.add(DocumentChunk(
                document_id=pdf_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        # 2. PPTX Slides Material
        pptx_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="DL_Lecture04_CNNs_and_Computer_Vision.pptx",
            file_type="pptx",
            storage_url=f"deep_learning/{course.id}/DL_Lecture04_CNNs_and_Computer_Vision.pptx",
            file_size=3450000,
        )
        pptx_doc.processing_status = "COMPLETED"

        pptx_chunks = [
            (
                "Lecture 4: Convolutional Neural Networks (CNN) Architecture.\nFully connected layers discard 2D spatial context and require massive parameter counts for images. CNNs introduce local receptive fields: small learnable filters or kernels (such as 3x3 matrices) slide across the input image grid. Each filter computes local dot products, detecting translation-invariant visual features like edges, textures, curves, and object parts regardless of their position in the image.",
                None, 12, None, None, "Convolutional Neural Networks (CNN)"
            ),
            (
                "Padding, Strides, and Pooling Operations in CNNs:\n- Padding (Valid vs Same): Adding zero border pixels to maintain feature map spatial dimensions and preserve corner information.\n- Stride: Number of pixels the convolution filter shifts per step. Higher strides reduce output spatial dimensions.\n- Max Pooling: Selects the maximum value in local patches (e.g. 2x2 with stride 2), providing spatial downsampling and translation invariance while drastically reducing compute.",
                None, 20, None, None, "Convolutional Neural Networks (CNN)"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(pptx_chunks):
            db.add(DocumentChunk(
                document_id=pptx_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        # 3. Video Lecture Material
        video_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="DL_Lecture07_Transformers_and_Attention.mp4",
            file_type="video",
            storage_url=f"deep_learning/{course.id}/DL_Lecture07_Transformers_and_Attention.mp4",
            file_size=19800000,
        )
        video_doc.processing_status = "COMPLETED"

        video_chunks = [
            (
                "Professor: 'Let's examine why the Transformer architecture revolutionized modern Artificial Intelligence. Older sequence models like RNNs and LSTMs had to process words sequentially one after another. That sequential constraint made parallel training impossible and caused long-range memory loss. The Transformer discards recurrence entirely and relies purely on Self-Attention: every word calculates Query, Key, and Value vectors, allowing all tokens to attend to each other simultaneously in parallel O(1) operations.'",
                None, None, "10:15", "13:30", "Transformers & Self-Attention"
            ),
            (
                "Professor: 'Scaled Dot-Product Attention is computed as: Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V. We divide by sqrt(d_k) to prevent dot products from growing excessively large for high dimensions, which would push the softmax function into regions with tiny vanishing gradients. In Multi-Head Attention, we project Q, K, and V into multiple subspaces in parallel, allowing the model to simultaneously attend to syntax, semantics, and factual associations.'",
                None, None, "13:31", "16:45", "Transformers & Self-Attention"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(video_chunks):
            db.add(DocumentChunk(
                document_id=video_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        # 4. Optimization & Regularization Study Notes
        opt_doc = DocumentRepository.create(
            db=db,
            course_id=course.id,
            filename="DL_Study_Guide_Optimization_and_Regularization.pdf",
            file_type="pdf",
            storage_url=f"deep_learning/{course.id}/DL_Study_Guide_Optimization_and_Regularization.pdf",
            file_size=1250000,
        )
        opt_doc.processing_status = "COMPLETED"

        opt_chunks = [
            (
                "Adaptive Optimizers: Stochastic Gradient Descent (SGD) with Momentum accelerates training in the relevant direction and dampens oscillations. The Adam optimizer (Adaptive Moment Estimation) combines Momentum with RMSprop by tracking exponentially decaying moving averages of both past gradients (first moment) and squared gradients (second moment). It computes adaptive individual learning rates for every parameter, making it the most robust general-purpose optimizer in modern deep learning.",
                8, None, None, None, "Optimization & Gradient Descent"
            ),
            (
                "Regularization in Deep Learning: To prevent deep networks from overfitting, Dropout randomly deactivates a percentage p (e.g. 20% to 50%) of neurons during each forward training pass, preventing complex co-adaptations. Batch Normalization normalizes activations at each mini-batch to zero mean and unit variance, allowing higher learning rates and acting as a mild regularizer.",
                18, None, None, None, "Regularization & Normalization"
            ),
        ]

        for idx, (content, page, slide, t_start, t_end, topic) in enumerate(opt_chunks):
            db.add(DocumentChunk(
                document_id=opt_doc.id,
                course_id=course.id,
                content=content,
                chunk_index=idx,
                page_number=page,
                slide_number=slide,
                timestamp_start=t_start,
                timestamp_end=t_end,
                topic=topic,
            ))

        db.commit()
        logger.info(f"Seeded 4 comprehensive Deep Learning multimodal materials with citations into course {course.id}")
        return cls.list_documents(db, course_id, user_id)
