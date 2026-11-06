/**
 * Middleware for validating lesson creation input
 */
const validateLesson = (req, res, next) => {
  const { title, learningObjective } = req.body || {};
  const errors = [];

  // Validate title
  if (!title || typeof title !== 'string' || title.trim() === '') {
    errors.push('Lesson title is required.');
  } else if (title.trim().length < 3) {
    errors.push('Lesson title must be at least 3 characters long.');
  } else if (title.trim().length > 150) {
    errors.push('Lesson title must not exceed 150 characters.');
  }

  // Validate learning objective
  if (!learningObjective || typeof learningObjective !== 'string' || learningObjective.trim() === '') {
    errors.push('Learning objective is required.');
  } else if (learningObjective.trim().length < 5) {
    errors.push('Learning objective must be at least 5 characters long.');
  } else if (learningObjective.trim().length > 2000) {
    errors.push('Learning objective must not exceed 2000 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Clean / sanitize strings for controller
  req.body.title = title.trim();
  req.body.learningObjective = learningObjective.trim();

  next();
};

module.exports = {
  validateLesson
};
