"""
Tool 9: AI Overview Traffic Impact Checker
Based on seoaireview.com

Analyzes which keywords a site ranks for that are likely
being affected by AI Overviews in Google.
"""

import re
from urllib.parse import urlparse

import aiohttp
from bs4 import BeautifulSoup


# Keywords patterns most likely to trigger AI Overviews
AI_OVERVIEW_TRIGGER_PATTERNS = [
    "que es", "como", "por que", "cual es", "mejores",
    "diferencia entre", "tutorial", "guia", "pasos para",
    "what is", "how to", "why", "best", "top", "vs",
    "difference between", "guide", "tutorial", "steps",
]

INTENT_CATEGORIES = {
    "informational": {
        "keywords": ["que", "como", "por que", "what", "how", "why", "guide", "tutorial", "learn"],
        "ai_overview_risk": 62,
        "description": "Consultas informativas - mayor riesgo de AI Overview",
    },
    "commercial": {
        "keywords": ["mejor", "best", "top", "review", "comparar", "vs", "alternativa"],
        "ai_overview_risk": 45,
        "description": "Consultas comerciales - riesgo medio",
    },
    "transactional": {
        "keywords": ["comprar", "buy", "precio", "price", "plan", "contratar", "subscribe"],
        "ai_overview_risk": 20,
        "description": "Consultas transaccionales - bajo riesgo",
    },
    "navigational": {
        "keywords": ["login", "acceder", "sitio", "pagina", "contacto", "site"],
        "ai_overview_risk": 10,
        "description": "Consultas de navegacion - riesgo minimo",
    },
}


class AIOverviewChecker:

    def __init__(self, timeout: int = 15, max_pages: int = 20):
        self.timeout = timeout
        self.max_pages = max_pages

    async def check(self, url: str) -> dict:
        if not url.startswith("http"):
            url = "https://" + url

        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "")
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        connector = aiohttp.TCPConnector(limit=5, ssl=False)
        timeout_config = aiohttp.ClientTimeout(total=self.timeout)

        extracted_keywords = []
        pages_data = []

        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout_config,
            headers={"User-Agent": "CleexsAIOverview/1.0"}
        ) as session:
            # Crawl site to extract keyword targets from content
            visited = set()
            to_visit = [url]

            while to_visit and len(visited) < self.max_pages:
                current = to_visit.pop(0)
                if current in visited:
                    continue

                current_parsed = urlparse(current)
                if current_parsed.netloc.replace("www.", "") != domain:
                    continue

                visited.add(current)

                try:
                    async with session.get(current, allow_redirects=True) as resp:
                        if resp.status != 200:
                            continue
                        ct = resp.headers.get("content-type", "")
                        if "text/html" not in ct:
                            continue
                        html = await resp.text()
                except Exception:
                    continue

                soup = BeautifulSoup(html, "lxml")
                page_keywords = self._extract_page_keywords(current, soup)
                pages_data.append({
                    "url": current,
                    "keywords": page_keywords,
                })
                extracted_keywords.extend(page_keywords)

                # Follow links (sorted for deterministic order)
                new_links = set()
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    if href.startswith("/"):
                        full = base_url + href
                    elif href.startswith("http"):
                        full = href
                    else:
                        continue

                    full_parsed = urlparse(full)
                    clean = f"{full_parsed.scheme}://{full_parsed.netloc}{full_parsed.path}"
                    if clean not in visited and full_parsed.netloc.replace("www.", "") == domain:
                        new_links.add(clean)
                to_visit.extend(sorted(new_links))

        # Analyze keywords
        keyword_analysis = self._analyze_keywords(extracted_keywords)

        # Calculate impact
        impact = self._calculate_impact(keyword_analysis)

        # Suggestions
        suggestions = self._generate_suggestions(impact, keyword_analysis)

        score = self._calculate_score(impact)

        return {
            "url": url,
            "domain": domain,
            "pages_analyzed": len(pages_data),
            "total_keywords": len(extracted_keywords),
            "keyword_analysis": keyword_analysis,
            "impact": impact,
            "intent_breakdown": self._intent_breakdown(keyword_analysis),
            "suggestions": suggestions,
            "score": score,
            "high_risk_keywords": [k for k in keyword_analysis if k["risk_level"] == "alto"][:15],
        }

    def _extract_page_keywords(self, url: str, soup: BeautifulSoup) -> list:
        keywords = []

        # From title
        title = soup.find("title")
        if title:
            keywords.append(title.get_text(strip=True))

        # From meta description
        meta = soup.find("meta", attrs={"name": "description"})
        if meta and meta.get("content"):
            keywords.append(meta["content"])

        # From H1, H2
        for tag in soup.find_all(["h1", "h2"])[:5]:
            text = tag.get_text(strip=True)
            if text and len(text) < 100:
                keywords.append(text)

        # From meta keywords
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw and meta_kw.get("content"):
            for kw in meta_kw["content"].split(",")[:5]:
                kw = kw.strip()
                if kw:
                    keywords.append(kw)

        return list(set(keywords))

    def _analyze_keywords(self, keywords: list) -> list:
        analyzed = []
        seen = set()

        for kw in keywords:
            kw_lower = kw.lower().strip()
            if kw_lower in seen or len(kw_lower) < 3:
                continue
            seen.add(kw_lower)

            # Determine intent
            intent = self._classify_intent(kw_lower)

            # Check AI Overview trigger risk
            triggers_ai = any(p in kw_lower for p in AI_OVERVIEW_TRIGGER_PATTERNS)
            base_risk = INTENT_CATEGORIES.get(intent, {}).get("ai_overview_risk", 30)

            if triggers_ai:
                risk_pct = min(base_risk + 20, 95)
                risk_level = "alto" if risk_pct > 50 else "medio"
            else:
                risk_pct = base_risk
                risk_level = "alto" if risk_pct > 50 else "medio" if risk_pct > 25 else "bajo"

            analyzed.append({
                "keyword": kw[:80],
                "intent": intent,
                "ai_overview_risk_pct": risk_pct,
                "risk_level": risk_level,
                "triggers_ai_overview": triggers_ai,
            })

        analyzed.sort(key=lambda x: x["ai_overview_risk_pct"], reverse=True)
        return analyzed[:50]

    def _classify_intent(self, kw: str) -> str:
        for intent, data in INTENT_CATEGORIES.items():
            if any(word in kw for word in data["keywords"]):
                return intent
        return "informational"

    def _calculate_impact(self, keyword_analysis: list) -> dict:
        total = len(keyword_analysis)
        if total == 0:
            return {"affected_pct": 0, "high_risk": 0, "medium_risk": 0, "low_risk": 0}

        high = sum(1 for k in keyword_analysis if k["risk_level"] == "alto")
        medium = sum(1 for k in keyword_analysis if k["risk_level"] == "medio")
        low = sum(1 for k in keyword_analysis if k["risk_level"] == "bajo")

        affected = high + medium
        affected_pct = round((affected / total) * 100) if total > 0 else 0

        avg_risk = round(sum(k["ai_overview_risk_pct"] for k in keyword_analysis) / total) if total > 0 else 0

        return {
            "total_keywords": total,
            "affected_pct": affected_pct,
            "high_risk": high,
            "medium_risk": medium,
            "low_risk": low,
            "avg_risk_pct": avg_risk,
        }

    def _intent_breakdown(self, keyword_analysis: list) -> list:
        breakdown = {}
        for k in keyword_analysis:
            intent = k["intent"]
            if intent not in breakdown:
                cat_data = INTENT_CATEGORIES.get(intent, {})
                breakdown[intent] = {
                    "intent": intent,
                    "count": 0,
                    "avg_risk": 0,
                    "description": cat_data.get("description", ""),
                    "base_ai_risk": cat_data.get("ai_overview_risk", 0),
                }
            breakdown[intent]["count"] += 1
            breakdown[intent]["avg_risk"] += k["ai_overview_risk_pct"]

        result = []
        for data in breakdown.values():
            if data["count"] > 0:
                data["avg_risk"] = round(data["avg_risk"] / data["count"])
            result.append(data)

        result.sort(key=lambda x: x["avg_risk"], reverse=True)
        return result

    def _generate_suggestions(self, impact: dict, keywords: list) -> list:
        suggestions = []

        if impact.get("affected_pct", 0) > 50:
            suggestions.append({
                "priority": "alta",
                "message": f"{impact['affected_pct']}% de tus keywords estan en riesgo de AI Overview",
                "detail": "Mas de la mitad de tus consultas objetivo podrian ser respondidas directamente por Google AI Overview, reduciendo clicks a tu sitio.",
            })

        if impact.get("high_risk", 0) > 5:
            suggestions.append({
                "priority": "alta",
                "message": f"{impact['high_risk']} keywords de alto riesgo detectadas",
                "detail": "Estas keywords tienen alta probabilidad de generar AI Overview. Diversifica hacia consultas transaccionales y long-tail.",
            })

        suggestions.append({
            "priority": "media",
            "message": "Optimiza tu contenido para ser citado EN el AI Overview",
            "detail": "Si no puedes evitar el AI Overview, asegurate de que tu contenido sea la fuente citada. Usa datos estructurados, listas claras y respuestas directas.",
        })

        suggestions.append({
            "priority": "media",
            "message": "Diversifica hacia keywords transaccionales",
            "detail": "Las consultas de compra y accion tienen menor riesgo de AI Overview. Crea contenido enfocado en decision de compra.",
        })

        return suggestions

    def _calculate_score(self, impact: dict) -> int:
        # Higher score = less impacted (better)
        affected = impact.get("affected_pct", 50)
        return max(0, min(100, 100 - affected))
