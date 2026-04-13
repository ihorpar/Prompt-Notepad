import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { marked } from 'marked';

marked.use({
  renderer: {
    code({ text, lang }) {
      const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="relative group mt-4 mb-4 rounded-md overflow-hidden bg-gray-900">
        <pre class="!my-0 !p-4"><code class="language-${lang}">${escapedText}</code></pre>
        <button onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy', 2000)" class="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer">Copy</button>
      </div>`;
    }
  }
});

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

export function ReviewModal({ isOpen, onClose, content }: ReviewModalProps) {
  const [reviewHtml, setReviewHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && content) {
      generateReview();
    }
  }, [isOpen]);

  const generateReview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate review');
      }
      
      const html = await marked.parse(data.text || '');
      setReviewHtml(html);
    } catch (err: any) {
      setError(err.message || 'Failed to generate review. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            Prompt Review
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 prose prose-sm dark:prose-invert max-w-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p>Analyzing prompt for inconsistencies and best practices...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 bg-red-50 dark:bg-red-500/10 p-4 rounded-lg">
              {error}
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: reviewHtml }} />
          )}
        </div>
      </div>
    </div>
  );
}
