const Question = require("../../models/Question.model");

// GET /api/test/all-questions - Fetch all questions in global bank
const getAllQuestions = async (req, res, next) => {
  try {
    const questions = await Question.find().select("+correctAnswer").sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/test/question/:id - Update existing question
const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question, options, correctAnswer, technology, type } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "Question ID is required" });
    }

    const updateData = {};
    if (question) updateData.question = question.trim();
    if (Array.isArray(options)) updateData.options = options.map(o => String(o || '').trim());
    if (correctAnswer !== undefined) updateData.correctAnswer = Number(correctAnswer);
    if (technology) updateData.technology = technology.trim();
    if (type) updateData.type = type;

    const updatedQuestion = await Question.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("+correctAnswer");

    if (!updatedQuestion) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    res.json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/test/question/:id - Delete question by ID
const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: "Question ID is required" });
    }

    const deleted = await Question.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Question not found" });
    }

    res.json({
      success: true,
      message: "Question deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllQuestions, updateQuestion, deleteQuestion };
