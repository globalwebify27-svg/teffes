const { z } = require('zod');

/**
 * Middleware factory: validates req.body against a Zod schema.
 * Returns 400 with formatted errors on failure.
 *
 * @param {z.ZodSchema} schema
 */
const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Replace req.body with the parsed (and sanitized) data
    req.body = result.data;
    next();
  };
};

module.exports = { validate };
