const { getConfig } = require("../lib/gemini");

module.exports = async (req, res) => {
  const { apiKey, model } = getConfig();
  res.status(200).json({
    status: "ok",
    geminiConfigured: Boolean(apiKey),
    model,
    time: new Date().toISOString(),
  });
};
