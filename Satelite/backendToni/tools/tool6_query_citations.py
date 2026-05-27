"""
Tool 6: Query Citation Tracker
Based on querycat.app

Generates relevant queries for a brand/site and shows
what types of queries would cite the site.
Analyzes the site's topical authority and citation-readiness.
"""

import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse


class QueryCitationTracker:

    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    async def analyze(self, url: str) -> dict:
        if not url.startswith("http"):
            url = "https://" + url

        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        brand = domain.split(".")[0].capitalize()

        connector = aiohttp.TCPConnector(limit=5, ssl=False)
        timeout_config = aiohttp.ClientTimeout(total=self.timeout)

        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout_config,
            headers={"User-Agent": "CleexsCitations/1.0"}
        ) as session:
            try:
                async with session.get(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        return self._error_result(url, f"HTTP {resp.status}")
                    html = await resp.text()
            except Exception as e:
                return self._error_result(url, str(e)[:200])

        soup = BeautifulSoup(html, "lxml")

        # Extract site topics and keywords
        topics = self._extract_topics(soup)
        categories = self._categorize_content(soup)

        # Generate queries that would likely cite this site
        queries = self._generate_citation_queries(brand, domain, topics, categories)

        # Citation readiness signals
        signals = self._analyze_citation_readiness(soup, brand)

        score = self._calculate_score(signals)

        return {
            "url": url,
            "brand": brand,
            "domain": domain,
            "topics": topics[:10],
            "content_categories": categories,
            "potential_queries": queries,
            "citation_signals": signals,
            "score": score,
            "ai_engines": ["ChatGPT", "Gemini", "Perplexity"],
        }

    def _extract_topics(self, soup: BeautifulSoup) -> list:
        topics = []

        # From meta keywords
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw and meta_kw.get("content"):
            topics.extend([k.strip() for k in meta_kw["content"].split(",") if k.strip()])

        # From headings
        for tag in soup.find_all(["h1", "h2", "h3"])[:10]:
            text = tag.get_text(strip=True)
            if text and len(text) < 100:
                topics.append(text)

        # From meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            topics.append(meta_desc["content"][:100])

        return list(dict.fromkeys(topics))  # unique, preserving order

    def _categorize_content(self, soup: BeautifulSoup) -> list:
        categories = []
        body = soup.find("body")
        if not body:
            return categories

        text = body.get_text(separator=" ", strip=True).lower()

        category_keywords = {
            "Tecnologia": ["software", "tech", "digital", "app", "platform", "saas", "api"],
            "Marketing": ["marketing", "seo", "brand", "advertising", "campaign"],
            "E-commerce": ["shop", "store", "buy", "price", "product", "cart"],
            "Educacion": ["learn", "course", "training", "education", "tutorial"],
            "Finanzas": ["finance", "invest", "money", "bank", "insurance"],
            "Salud": ["health", "medical", "wellness", "doctor", "patient"],
            "Servicios": ["service", "consulting", "agency", "solutions"],
            "Noticias": ["news", "article", "blog", "press", "media"],
        }

        for cat, keywords in category_keywords.items():
            count = sum(1 for kw in keywords if kw in text)
            if count >= 2:
                categories.append({"name": cat, "relevance": min(count * 20, 100)})

        categories.sort(key=lambda x: x["relevance"], reverse=True)
        return categories[:5]

    def _generate_citation_queries(self, brand: str, domain: str, topics: list, categories: list) -> list:
        queries = []

        # Brand queries
        queries.append({
            "query": f"Que es {brand}?",
            "type": "brand",
            "citation_probability": "alta",
            "reason": "Consulta directa de marca",
        })
        queries.append({
            "query": f"Opiniones sobre {brand}",
            "type": "brand",
            "citation_probability": "alta",
            "reason": "Busqueda de reputacion",
        })

        # Category queries
        for cat in categories[:3]:
            queries.append({
                "query": f"Mejores herramientas de {cat['name'].lower()}",
                "type": "category",
                "citation_probability": "media",
                "reason": f"Apareces en categoria {cat['name']}",
            })
            queries.append({
                "query": f"Comparativa de servicios de {cat['name'].lower()}",
                "type": "category",
                "citation_probability": "media",
                "reason": "Consulta comparativa del sector",
            })

        # Topic queries
        for topic in topics[:3]:
            if len(topic) < 80:
                queries.append({
                    "query": topic if "?" in topic else f"Como funciona {topic.lower()}?",
                    "type": "topic",
                    "citation_probability": "baja",
                    "reason": "Tema relacionado con tu contenido",
                })

        # Competitor queries
        queries.append({
            "query": f"Alternativas a {brand}",
            "type": "competitive",
            "citation_probability": "alta",
            "reason": "Busqueda competitiva directa",
        })

        return queries

    def _analyze_citation_readiness(self, soup: BeautifulSoup, brand: str) -> list:
        signals = []

        # Unique authoritative content
        body = soup.find("body")
        text = body.get_text(strip=True) if body else ""
        word_count = len(text.split())

        signals.append({
            "name": "Contenido sustancial",
            "status": "pass" if word_count >= 500 else "warning" if word_count >= 200 else "fail",
            "detail": f"~{word_count} palabras",
        })

        # FAQ content
        faq_indicators = soup.find_all(string=lambda t: t and ("?" in t) and len(t) > 20 and len(t) < 200)
        signals.append({
            "name": "Contenido tipo FAQ",
            "status": "pass" if len(faq_indicators) >= 3 else "warning" if len(faq_indicators) >= 1 else "fail",
            "detail": f"{len(faq_indicators)} preguntas detectadas en el contenido",
        })

        # Lists and structured info
        lists = soup.find_all(["ul", "ol"])
        tables = soup.find_all("table")
        signals.append({
            "name": "Informacion estructurada (listas/tablas)",
            "status": "pass" if len(lists) + len(tables) >= 3 else "warning" if len(lists) + len(tables) >= 1 else "fail",
            "detail": f"{len(lists)} listas, {len(tables)} tablas",
        })

        # Data and statistics
        import re
        numbers = re.findall(r'\d+[%$€]|\d+\.\d+|\d{3,}', text[:5000])
        signals.append({
            "name": "Datos y estadisticas",
            "status": "pass" if len(numbers) >= 5 else "warning" if len(numbers) >= 2 else "fail",
            "detail": f"{len(numbers)} datos numericos encontrados",
        })

        # Source attribution
        cite_tags = soup.find_all(["cite", "blockquote"])
        ref_links = [a for a in soup.find_all("a", href=True) if "source" in a.get_text(strip=True).lower() or "reference" in a.get_text(strip=True).lower()]
        signals.append({
            "name": "Citas y fuentes",
            "status": "pass" if len(cite_tags) + len(ref_links) >= 2 else "warning" if len(cite_tags) + len(ref_links) >= 1 else "fail",
            "detail": f"{len(cite_tags)} citas, {len(ref_links)} referencias",
        })

        return signals

    def _calculate_score(self, signals: list) -> int:
        if not signals:
            return 0
        total = len(signals)
        passed = sum(1 for s in signals if s["status"] == "pass")
        warned = sum(1 for s in signals if s["status"] == "warning")
        return round(((passed + warned * 0.5) / total) * 100)

    def _error_result(self, url: str, error: str) -> dict:
        return {
            "url": url, "brand": "", "domain": "", "topics": [],
            "content_categories": [], "potential_queries": [],
            "citation_signals": [], "score": 0, "ai_engines": [],
        }
