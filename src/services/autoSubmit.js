const redis = require("../config/redis");
const TestSession = require("../../models/TestSession.model");

const autoSubmit = async (studentId) => {
  const sessionKey = `test:session:${studentId}`;
  const answerKey = `test:answers:${studentId}`;
  const orderKey = `test:order:${studentId}`;

  // prevent double submit
  const submitLockKey = `test:submit:${studentId}`;
  const lock = await redis.set(submitLockKey, "1", "NX", "EX", 30);
  if (!lock) return null;

  // fetch answers
  const answers = await redis.hgetall(answerKey);

  // mark session submitted in Mongo
  await TestSession.findOneAndUpdate(
    { studentId, status: "STARTED" },
    { status: "SUBMITTED" }
  );

  // cleanup redis
  await redis.del(sessionKey, answerKey, orderKey);

  return answers;
};

module.exports = autoSubmit;
