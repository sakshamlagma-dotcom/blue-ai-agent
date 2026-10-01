export function handleUpload(req, res) {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: "No files were uploaded." });
  }
  const attachments = files.map((f) => ({
    fileId: f.filename,
    name: f.originalname,
    type: f.mimetype,
    size: f.size,
  }));
  res.json({ attachments });
}
