import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export function markdownToJson(md: string) {
  const lines = md.split('\n');
  const root: any = {};
  const stack = [{ level: 0, node: root }];
  let currentContent: string[] = [];

  const flushContent = () => {
    if (currentContent.length > 0 && currentContent.some(l => l.trim())) {
      const text = currentContent.join('\n').trim();
      if (text) {
        const currentNode = stack[stack.length - 1].node;
        currentNode._content = currentNode._content 
          ? currentNode._content + '\n\n' + text 
          : text;
      }
      currentContent = [];
    }
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      flushContent();

      const level = match[1].length;
      const title = match[2].trim();
      const newNode = {};

      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parentNode = stack[stack.length - 1].node;
      
      // Handle duplicate keys by making it an array
      if (parentNode[title]) {
        if (!Array.isArray(parentNode[title])) {
          parentNode[title] = [parentNode[title]];
        }
        parentNode[title].push(newNode);
      } else {
        parentNode[title] = newNode;
      }
      
      stack.push({ level, node: newNode });
    } else {
      currentContent.push(line);
    }
  }
  
  flushContent();
  
  return root;
}

export function jsonToMarkdown(obj: any, level = 1): string {
  let md = '';
  if (typeof obj !== 'object' || obj === null) {
    return String(obj) + '\n\n';
  }

  for (const key in obj) {
    if (key === '_content') {
      md += obj[key] + '\n\n';
    } else {
      const value = obj[key];
      if (Array.isArray(value)) {
        value.forEach(item => {
          md += `${'#'.repeat(level)} ${key}\n\n`;
          md += jsonToMarkdown(item, level + 1);
        });
      } else {
        md += `${'#'.repeat(level)} ${key}\n\n`;
        if (typeof value === 'object') {
          md += jsonToMarkdown(value, level + 1);
        } else {
          md += value + '\n\n';
        }
      }
    }
  }
  return md.trim();
}

export function convertFormat(content: string, from: string, to: string): string {
  if (from === to) return content;
  if (!content.trim()) return content;
  
  let jsonObj: any = {};
  
  try {
    if (from === 'markdown') {
      jsonObj = markdownToJson(content);
    } else if (from === 'json') {
      jsonObj = JSON.parse(content);
    } else if (from === 'xml') {
      const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
      jsonObj = parser.parse(content);
    }
  } catch (e) {
    console.error("Parse error", e);
    return content;
  }

  try {
    if (to === 'markdown') {
      return jsonToMarkdown(jsonObj);
    } else if (to === 'json') {
      return JSON.stringify(jsonObj, null, 2);
    } else if (to === 'xml') {
      const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
      const keys = Object.keys(jsonObj);
      let xmlObj = jsonObj;
      if (keys.length !== 1 || typeof jsonObj[keys[0]] !== 'object') {
        xmlObj = { root: jsonObj };
      }
      return builder.build(xmlObj);
    }
  } catch (e) {
    console.error("Stringify error", e);
    return content;
  }
  
  return content;
}
