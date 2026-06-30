"""
Tool 5: AI Search Presence Tester
Based on mangools.com/ai-search-grader

Tests how a brand/website appears when queried in AI engines.
Since we can't call actual LLM APIs without keys, this tool:
1. Generates the prompts that would be tested
2. Provides a framework for testing manually or with API keys
3. Simulates the analysis structure
"""

import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse


class AIPresenceTester:
    """
    Analyzes how AI-ready a website is for being cited by LLMs.
    Checks signals that AI models use to decide what to cite:
    - Clear brand identity
    - Authoritative content structure
    - Schema markup
    - External references
    - Content clarity and topical authority
    """

    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    async def test(self, url: str) -> dict:
        if not url.startswith("http"):
            url = "https://" + url

        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        brand_name = domain.split(".")[0].capitalize()

        connector = aiohttp.TCPConnector(limit=5, ssl=False)
        timeout_config = aiohttp.ClientTimeout(total=self.timeout)

        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout_config,
            headers={"User-Agent": "CleexsPresence/1.0"}
        ) as session:
            try:
                async with session.get(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        return self._error_result(url, f"HTTP {resp.status}")
                    html = await resp.text()
            except Exception as e:
                return self._error_result(url, str(e)[:200])

        soup = BeautifulSoup(html, "lxml")

        # Analyze AI-readiness signals
        signals = self._analyze_signals(url, soup, domain, brand_name)

        # Generate test prompts
        prompts = self._generate_test_prompts(brand_name, domain, soup)

        # Calculate score
        score = self._calculate_score(signals)

        # Suggestions
        suggestions = self._generate_suggestions(signals)

        return {
            "url": url,
            "brand_name": brand_name,
            "domain": domain,
            "signals": signals,
            "test_prompts": prompts,
            "score": score,
            "suggestions": suggestions,
            "ai_engines": [
                {"name": "ChatGPT", "icon": "openai"},
                {"name": "Claude", "icon": "anthropic"},
                {"name": "Perplexity", "icon": "perplexity"},
                {"name": "Gemini", "icon": "google"},
                {"name": "AI Overviews", "icon": "google"},
            ],
        }

    def _analyze_signals(self, url: str, soup: BeautifulSoup, domain: str, brand: str) -> list:
        signals = []

        # 1. Brand Identity
        title = soup.find("title")
        title_text = title.get_text(strip=True) if title else ""
        has_brand_in_title = brand.lower() in title_text.lower() if title_text else False

        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc_text = meta_desc.get("content", "") if meta_desc else ""

        signals.append({
            "name": "Identidad de marca",
            "status": "pass" if has_brand_in_title and desc_text else "warning" if title_text else "fail",
            "details": f"Titulo: '{title_text[:60]}'" if title_text else "Sin titulo",
            "weight": 15,
        })

        # 2. Schema/Structured Data
        json_ld = soup.find_all("script", type="application/ld+json")
        has_schema = len(json_ld) > 0
        signals.append({
            "name": "Datos estructurados (Schema)",
            "status": "pass" if has_schema else "fail",
            "details": f"{len(json_ld)} bloques JSON-LD encontrados" if has_schema else "Sin schema - critico para visibilidad en IA",
            "weight": 20,
        })

        # 3. Content Structure
        h1 = soup.find_all("h1")
        h2 = soup.find_all("h2")
        h3 = soup.find_all("h3")
        heading_score = min(len(h1), 1) + min(len(h2), 3) + min(len(h3), 3)

        signals.append({
            "name": "Estructura de contenido",
            "status": "pass" if heading_score >= 4 else "warning" if heading_score >= 2 else "fail",
            "details": f"{len(h1)} H1, {len(h2)} H2, {len(h3)} H3",
            "weight": 15,
        })

        # 4. Meta Information
        og_tags = soup.find_all("meta", attrs={"property": lambda x: x and x.startswith("og:")})
        twitter_tags = soup.find_all("meta", attrs={"name": lambda x: x and x.startswith("twitter:")})

        signals.append({
            "name": "Meta tags sociales",
            "status": "pass" if len(og_tags) >= 3 else "warning" if len(og_tags) >= 1 else "fail",
            "details": f"{len(og_tags)} Open Graph, {len(twitter_tags)} Twitter Cards",
            "weight": 10,
        })

        # 5. External Authority
        external_links = set()
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if href.startswith("http") and domain not in href:
                link_domain = urlparse(href).netloc
                external_links.add(link_domain)

        signals.append({
            "name": "Enlaces externos (autoridad)",
            "status": "pass" if len(external_links) >= 3 else "warning" if len(external_links) >= 1 else "fail",
            "details": f"{len(external_links)} dominios externos referenciados",
            "weight": 10,
        })

        # 6. Content Length
        body = soup.find("body")
        text_content = body.get_text(strip=True) if body else ""
        word_count = len(text_content.split())

        signals.append({
            "name": "Profundidad de contenido",
            "status": "pass" if word_count >= 500 else "warning" if word_count >= 200 else "fail",
            "details": f"~{word_count} palabras en la pagina",
            "weight": 15,
        })

        # 7. About/Contact Information
        about_indicators = ["about", "acerca", "nosotros", "contact", "contacto", "quienes somos"]
        has_about = any(
            ind in (a.get("href", "").lower() + " " + a.get_text(strip=True).lower())
            for a in soup.find_all("a", href=True)
            for ind in about_indicators
        )

        signals.append({
            "name": "Informacion de identidad",
            "status": "pass" if has_about else "warning",
            "details": "Se encontraron paginas About/Contacto" if has_about else "Sin paginas claras de About/Contacto",
            "weight": 10,
        })

        # 8. Canonical & Language
        canonical = soup.find("link", rel="canonical")
        lang = soup.find("html")
        has_lang = lang.get("lang") if lang else None

        signals.append({
            "name": "Canonical y idioma",
            "status": "pass" if canonical and has_lang else "warning" if canonical or has_lang else "fail",
            "details": f"{'Canonical OK' if canonical else 'Sin canonical'}, {'Idioma: ' + has_lang if has_lang else 'Sin idioma declarado'}",
            "weight": 5,
        })

        return signals

    def _generate_test_prompts(self, brand: str, domain: str, soup: BeautifulSoup) -> list:
        # Extract keywords from meta/content
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        keywords = meta_kw.get("content", "").split(",")[:3] if meta_kw else []
        keywords = [k.strip() for k in keywords if k.strip()]

        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc = meta_desc.get("content", "") if meta_desc else ""

        prompts = [
            {
                "prompt": f"Que es {brand}?",
                "engine": "Todos",
                "purpose": "Verifica si la IA conoce tu marca",
            },
            {
                "prompt": f"Que hace {domain}?",
                "engine": "Todos",
                "purpose": "Verifica si asocia tu dominio con tu servicio",
            },
            {
                "prompt": f"Cuales son las mejores alternativas a {brand}?",
                "engine": "Todos",
                "purpose": "Verifica si apareces en comparativas",
            },
            {
                "prompt": f"Recomienda empresas de {desc[:50]}..." if desc else f"Recomienda empresas como {brand}",
                "engine": "ChatGPT / Perplexity",
                "purpose": "Verifica si te recomiendan en tu nicho",
            },
            {
                "prompt": f"Que opiniones hay sobre {brand}?",
                "engine": "Perplexity / Gemini",
                "purpose": "Verifica percepcion de marca en IA",
            },
        ]

        if keywords:
            prompts.append({
                "prompt": f"Mejores herramientas de {keywords[0]}",
                "engine": "Todos",
                "purpose": "Verifica visibilidad en busquedas de categoria",
            })

        return prompts

    def _calculate_score(self, signals: list) -> int:
        total_weight = sum(s["weight"] for s in signals)
        earned = 0
        for s in signals:
            if s["status"] == "pass":
                earned += s["weight"]
            elif s["status"] == "warning":
                earned += s["weight"] * 0.5
        return round((earned / total_weight) * 100) if total_weight > 0 else 0

    def _generate_suggestions(self, signals: list) -> list:
        suggestions = []

        for s in signals:
            if s["status"] == "fail":
                suggestions.append({
                    "priority": "alta",
                    "message": f"{s['name']}: necesita mejora urgente",
                    "detail": s["details"],
                })
            elif s["status"] == "warning":
                suggestions.append({
                    "priority": "media",
                    "message": f"{s['name']}: puede mejorar",
                    "detail": s["details"],
                })

        if not suggestions:
            suggestions.append({
                "priority": "info",
                "message": "Tu sitio tiene buenas senales para visibilidad en IA",
                "detail": "Todas las senales clave estan cubiertas. Usa los prompts de prueba para verificar tu presencia real.",
            })

        return suggestions

    def _error_result(self, url: str, error: str) -> dict:
        return {
            "url": url,
            "brand_name": "",
            "domain": "",
            "signals": [],
            "test_prompts": [],
            "score": 0,
            "suggestions": [{"priority": "critica", "message": f"Error: {error}", "detail": ""}],
            "ai_engines": [],
        }
