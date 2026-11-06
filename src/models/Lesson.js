const mongoose = require('mongoose');

/**
 * Lesson Schema
 * Defines the structure of lesson documents in MongoDB.
 * Designed to be modular and ready for LangGraph AI agent orchestration in future stages.
 */
const lessonSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Lesson title is required'],
      trim: true,
      minlength: [3, 'Lesson title must be at least 3 characters long'],
      maxlength: [150, 'Lesson title cannot exceed 150 characters']
    },
    learningObjective: {
      type: String,
      required: [true, 'Learning objective is required'],
      trim: true,
      minlength: [5, 'Learning objective must be at least 5 characters long'],
      maxlength: [2000, 'Learning objective cannot exceed 2000 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'generating', 'completed', 'failed'],
        message: '{VALUE} is not a supported lesson status'
      },
      default: 'draft'
    },
    content: {
      type: String,
      default: '',
      trim: true
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({})
    }
  },
  {
    timestamps: true // Automatically creates createdAt and updatedAt fields
  }
);

// Helpful index for sorting by creation date
lessonSchema.index({ createdAt: -1 });

const Lesson = mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;
