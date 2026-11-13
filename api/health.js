export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    platform: 'vercel',
    message: 'Frontend serverless API is online.',
  });
}

