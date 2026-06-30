import re
from dataclasses import dataclass, field
from typing import Optional

import aiohttp
from bs4 import BeautifulSoup, Comment


@dataclass
class AXPResult:
    url: str
    original_size: int = 0
    optimized_size: int = 0
    original_tokens_est: int = 0
    optimized_tokens_est: int = 0
    reduction_pct: float = 0.0
    ai_friendly_content: str = ""
    sections: list = field(default_factory=list)
    issues: list = field(default_factory=list)
    suggestions: list = field(default_factory=list)
    score: int = 0


class AXPGenerator:
    """
    Creates an AI-friendly version of a webpage.
    Strips unnecessary HTML, scripts, styles, and navigation.
    Restructures content into clean, semantic text that AI agents can consume efficiently.
    """

    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    async def generate(self, url: str) -> dict:
        if not url.startswith("http"):
            url = "https://" + url

        connector = aiohttp.TCPConnector(limit=5, ssl=False)
        timeout_config = aiohttp.ClientTimeout(total=self.timeout)

        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout_config,
            headers={"User-Agent": "CleexsAXP/1.0"}
        ) as session:
            try:
                async with session.get(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        return self._error_result(url, f"HTTP {resp.status}")
                    html = await resp.text()
            except Exception as e:
                return self._error_result(url, str(e)[:200])

        result = AXPResult(url=url)
        result.original_size = len(html.encode("utf-8"))
        result.original_tokens_est = len(html.split()) * 2  # rough estimate

        soup = BeautifulSoup(html, "lxml")

        # Extract page metadata
        title = ""
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text(strip=True)

        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag:
            meta_desc = meta_tag.get("content", "")

        # Remove unnecessary elements
        for tag in soup.find_all(["script", "style", "noscript", "iframe", "svg", "canvas"]):
            tag.decompose()

        # Remove comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Remove nav, footer, aside, header (non-content areas)
        for tag in soup.find_all(["nav", "footer", "aside"]):
            tag.decompose()

        # Remove hidden elements
        for tag in soup.find_all(attrs={"style": re.compile(r"display\s*:\s*none")}):
            tag.decompose()
        for tag in soup.find_all(attrs={"hidden": True}):
            tag.decompose()
        for tag in soup.find_all(attrs={"aria-hidden": "true"}):
            tag.decompose()

        # Remove form elements
        for tag in soup.find_all(["form", "input", "button", "select", "textarea"]):
            tag.decompose()

        # Extract structured content
        sections = []

        # Title section
        if title:
            sections.append({"type": "title", "content": title})

        # Description
        if meta_desc:
            sections.append({"type": "description", "content": meta_desc})

        # Headings and content
        body = soup.find("body")
        if body:
            current_section = None
            for element in body.find_all(["h1", "h2", "h3", "h4", "p", "li", "td", "blockquote", "figcaption"]):
                text = element.get_text(strip=True)
                if not text or len(text) < 3:
                    continue

                tag_name = element.name
                if tag_name in ("h1", "h2", "h3", "h4"):
                    if current_section:
                        sections.append(current_section)
                    current_section = {
                        "type": "section",
                        "heading": text,
                        "heading_level": tag_name,
                        "content": [],
                    }
                elif current_section:
                    current_section["content"].append(text)
                else:
                    current_section = {
                        "type": "section",
                        "heading": "",
                        "heading_level": "",
                        "content": [text],
                    }

            if current_section:
                sections.append(current_section)

        # Extract links (important for AI context)
        links = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            link_text = a.get_text(strip=True)
            if link_text and href and not href.startswith("#") and not href.startswith("javascript"):
                links.append({"text": link_text, "href": href})

        if links:
            sections.append({"type": "links", "content": links[:30]})

        # Extract images with alt text
        images = []
        for img in soup.find_all("img", alt=True):
            alt = img.get("alt", "").strip()
            src = img.get("src", "")
            if alt and src:
                images.append({"alt": alt, "src": src})

        if images:
            sections.append({"type": "images", "content": images[:20]})

        result.sections = sections

        # Generate AI-friendly text
        ai_text = self._generate_ai_text(url, title, meta_desc, sections)
        result.ai_friendly_content = ai_text
        result.optimized_size = len(ai_text.encode("utf-8"))
        result.optimized_tokens_est = len(ai_text.split())

        if result.original_size > 0:
            result.reduction_pct = round(
                (1 - result.optimized_size / result.original_size) * 100, 1
            )

        # Analyze issues
        result.issues = self._find_issues(soup, html, title, meta_desc)
        result.suggestions = self._generate_suggestions(result)
        result.score = self._calculate_score(result)

        return {
            "url": result.url,
            "original_size": result.original_size,
            "optimized_size": result.optimized_size,
            "original_tokens_est": result.original_tokens_est,
            "optimized_tokens_est": result.optimized_tokens_est,
            "reduction_pct": result.reduction_pct,
            "ai_friendly_content": result.ai_friendly_content,
            "sections_count": len([s for s in sections if s.get("type") == "section"]),
            "issues": result.issues,
            "suggestions": result.suggestions,
            "score": result.score,
        }

    def _generate_ai_text(self, url: str, title: str, description: str, sections: list) -> str:
        lines = []
        lines.append(f"# {title}" if title else f"# {url}")
        lines.append(f"URL: {url}")
        if description:
            lines.append(f"Description: {description}")
        lines.append("")

        for section in sections:
            if section["type"] == "title":
                continue
            elif section["type"] == "description":
                continue
            elif section["type"] == "section":
                heading = section.get("heading", "")
                level = section.get("heading_level", "h2")
                content_list = section.get("content", [])

                if heading:
                    prefix = "#" * min(int(level[1]) if level and level[0] == "h" else 2, 4)
                    lines.append(f"{prefix} {heading}")

                for text in content_list:
                    lines.append(text)
                lines.append("")
            elif section["type"] == "links":
                lines.append("## Links")
                for link in section["content"][:15]:
                    lines.append(f"- {link['text']}: {link['href']}")
                lines.append("")
            elif section["type"] == "images":
                lines.append("## Images")
                for img in section["content"][:10]:
                    lines.append(f"- {img['alt']}")
                lines.append("")

        return "\n".join(lines)

    def _find_issues(self, soup: BeautifulSoup, html: str, title: str, meta_desc: str) -> list:
        issues = []

        if not title:
            issues.append({
                "severity": "critical",
                "message": "Sin titulo de pagina - los AI agents no pueden identificar el contenido",
            })

        if not meta_desc:
            issues.append({
                "severity": "warning",
                "message": "Sin meta description - los AI agents no tienen resumen del contenido",
            })

        # Check for JavaScript-heavy content
        script_count = html.lower().count("<script")
        if script_count > 15:
            issues.append({
                "severity": "warning",
                "message": f"{script_count} scripts detectados - contenido puede depender de JavaScript que las IAs no ejecutan",
            })

        # Check for iframes
        iframe_count = len(soup.find_all("iframe"))
        if iframe_count > 0:
            issues.append({
                "severity": "info",
                "message": f"{iframe_count} iframes detectados - contenido dentro de iframes es invisible para IAs",
            })

        # Check page size
        if len(html.encode("utf-8")) > 500000:
            issues.append({
                "severity": "warning",
                "message": "Pagina muy pesada (>500KB) - IAs consumen mas tokens y pueden truncar contenido",
            })

        return issues

    def _generate_suggestions(self, result: AXPResult) -> list:
        suggestions = []

        if result.reduction_pct > 80:
            suggestions.append({
                "priority": "info",
                "message": f"La version AI es {result.reduction_pct}% mas liviana que la original",
                "detail": "Gran reduccion. Tu pagina tiene mucho contenido no textual que las IAs no necesitan.",
            })

        suggestions.append({
            "priority": "media",
            "message": "Considera servir la version AI a bots de IA automaticamente",
            "detail": "Puedes detectar User-Agents de bots de IA y servirles la version optimizada. Esto reduce costos de tokens y mejora la comprension.",
        })

        if result.optimized_tokens_est > 5000:
            suggestions.append({
                "priority": "media",
                "message": "La version AI todavia es extensa - considera priorizar contenido clave",
                "detail": "Los motores de IA tienen limites de contexto. Pon la informacion mas importante al inicio.",
            })

        return suggestions

    def _calculate_score(self, result: AXPResult) -> int:
        score = 50  # Base

        # Good reduction
        if result.reduction_pct > 70:
            score += 15
        elif result.reduction_pct > 50:
            score += 10

        # Content structure
        section_count = len([s for s in result.sections if s.get("type") == "section"])
        if section_count >= 3:
            score += 15
        elif section_count >= 1:
            score += 5

        # Issues penalty
        for issue in result.issues:
            if issue["severity"] == "critical":
                score -= 15
            elif issue["severity"] == "warning":
                score -= 5

        return max(0, min(100, score))

    def _error_result(self, url: str, error: str) -> dict:
        return {
            "url": url,
            "original_size": 0,
            "optimized_size": 0,
            "original_tokens_est": 0,
            "optimized_tokens_est": 0,
            "reduction_pct": 0,
            "ai_friendly_content": "",
            "sections_count": 0,
            "issues": [{"severity": "critical", "message": f"Error: {error}"}],
            "suggestions": [],
            "score": 0,
        }
