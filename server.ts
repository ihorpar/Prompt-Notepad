import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Simple auth middleware
  const checkAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) {
      return next(); // If no password configured, allow access
    }
    
    const token = req.cookies.auth_token;
    if (token && token === crypto.createHash('sha256').update(appPassword).digest('hex')) {
      return next();
    }
    
    res.status(401).json({ error: 'Unauthorized' });
  };

  app.post('/api/auth', (req, res) => {
    const { password } = req.body;
    const appPassword = process.env.APP_PASSWORD;
    
    if (!appPassword) {
      res.json({ success: true });
      return;
    }

    if (password === appPassword) {
      const token = crypto.createHash('sha256').update(appPassword).digest('hex');
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  });

  app.get('/api/auth/status', (req, res) => {
    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) {
      res.json({ authenticated: true, requiresAuth: false });
      return;
    }
    
    const token = req.cookies.auth_token;
    if (token && token === crypto.createHash('sha256').update(appPassword).digest('hex')) {
      res.json({ authenticated: true, requiresAuth: true });
    } else {
      res.json({ authenticated: false, requiresAuth: true });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
  });

  app.post('/api/review', checkAuth, async (req, res) => {
    try {
      const { content } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on the server.');
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an expert Prompt Engineer. Review the following prompt for clarity, structural integrity, and potential for high-quality LLM output.

Analyze the prompt based on these criteria:
1. **Clarity & Specificity**: Are the instructions unambiguous?
2. **Structure**: Is the use of formats (Markdown, XML, JSON) consistent and helpful?
3. **Context**: Does the prompt provide enough context for the task?
4. **Constraints**: Are the limitations and requirements clearly defined?
5. **Potential Issues**: Identify any internal contradictions, biases, or areas prone to hallucination.

Provide a detailed review with:
- **Strengths**: What works well.
- **Areas for Improvement**: Specific suggestions for refinement.
- **Optimized Snippets**: Provide improved versions of specific sections in code blocks.

Prompt to review:
---
${content}
---`
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error('AI Review Error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate review' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
