"""
Tool 7: Mention Alerts Setup
Based on alertmouse.com

Analyzes where a brand is currently mentioned and sets up
monitoring recommendations. Since real-time alerts need
a persistent backend, this tool:
1. Scans for current brand mentions across accessible sources
2. Sets up alert configurations
3. Provides a framework for monitoring
"""

import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse, quote_plus


class MentionAlertAnalyzer:

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

        # Extract brand info from the site
        async with aiohttp.ClientSession(
            connector=connector,
            timeout=timeout_config,
            headers={"User-Agent": "CleexsAlerts/1.0"}
        ) as session:
            try:
                async with session.get(url, allow_redirects=True) as resp:
                    if resp.status != 200:
                        return self._error_result(url, f"HTTP {resp.status}")
                    html = await resp.text()
            except Exception as e:
                return self._error_result(url, str(e)[:200])

        soup = BeautifulSoup(html, "lxml")

        # Extract brand keywords
        brand_keywords = self._extract_brand_keywords(soup, brand, domain)

        # Generate monitoring queries
        monitoring_queries = self._generate_monitoring_queries(brand, domain, brand_keywords)

        # Monitoring channels
        channels = self._get_monitoring_channels(brand, domain)

        # Alert rules
        alert_rules = self._generate_alert_rules(brand, brand_keywords)

        # Current visibility check
        visibility = self._check_visibility_signals(soup, brand)

        score = self._calculate_score(visibility)

        return {
            "url": url,
            "brand": brand,
            "domain": domain,
            "brand_keywords": brand_keywords,
            "monitoring_queries": monitoring_queries,
            "channels": channels,
            "alert_rules": alert_rules,
            "visibility_signals": visibility,
            "score": score,
        }

    def _extract_brand_keywords(self, soup: BeautifulSoup, brand: str, domain: str) -> list:
        keywords = [brand, domain]

        # From meta
        meta_kw = soup.find("meta", attrs={"name": "keywords"})
        if meta_kw and meta_kw.get("content"):
            for kw in meta_kw["content"].split(",")[:5]:
                kw = kw.strip()
                if kw and kw not in keywords:
                    keywords.append(kw)

        # From title
        title = soup.find("title")
        if title:
            title_text = title.get_text(strip=True)
            words = [w for w in title_text.split() if len(w) > 3]
            for w in words[:3]:
                if w.lower() not in [k.lower() for k in keywords]:
                    keywords.append(w)

        return keywords[:8]

    def _generate_monitoring_queries(self, brand: str, domain: str, keywords: list) -> list:
        queries = [
            {
                "query": f'"{brand}"',
                "type": "exact_match",
                "description": "Menciones exactas de tu marca",
            },
            {
                "query": f'"{domain}"',
                "type": "domain",
                "description": "Enlaces y menciones de tu dominio",
            },
            {
                "query": f'"{brand}" review OR opinion OR experience',
                "type": "sentiment",
                "description": "Opiniones y resenas sobre tu marca",
            },
            {
                "query": f'"{brand}" vs OR alternative OR competitor',
                "type": "competitive",
                "description": "Comparaciones con competidores",
            },
        ]

        for kw in keywords[2:4]:
            queries.append({
                "query": f'"{kw}" {brand}',
                "type": "topical",
                "description": f"Menciones en contexto de '{kw}'",
            })

        return queries

    def _get_monitoring_channels(self, brand: str, domain: str) -> list:
        encoded_brand = quote_plus(brand)
        return [
            {
                "name": "Google Alerts",
                "type": "web",
                "setup_url": f"https://www.google.com/alerts#1:1:d:f:t:0:{encoded_brand}",
                "description": "Alertas gratuitas de Google para menciones web",
                "status": "manual",
            },
            {
                "name": "ChatGPT",
                "type": "ai",
                "setup_url": "",
                "description": "Monitorea que dice ChatGPT sobre tu marca periodicamente",
                "status": "manual",
            },
            {
                "name": "Perplexity",
                "type": "ai",
                "setup_url": "",
                "description": "Verifica tus menciones en Perplexity semanalmente",
                "status": "manual",
            },
            {
                "name": "Google Search",
                "type": "search",
                "setup_url": f"https://www.google.com/search?q=%22{encoded_brand}%22&tbs=qdr:w",
                "description": "Busca menciones recientes en Google (ultima semana)",
                "status": "manual",
            },
            {
                "name": "Reddit",
                "type": "social",
                "setup_url": f"https://www.reddit.com/search/?q={encoded_brand}&sort=new",
                "description": "Menciones recientes en Reddit",
                "status": "manual",
            },
            {
                "name": "Twitter/X",
                "type": "social",
                "setup_url": f"https://twitter.com/search?q={encoded_brand}&f=live",
                "description": "Menciones en tiempo real en Twitter/X",
                "status": "manual",
            },
        ]

    def _generate_alert_rules(self, brand: str, keywords: list) -> list:
        return [
            {
                "name": "Mencion de marca",
                "trigger": f'Cualquier mencion de "{brand}"',
                "priority": "alta",
                "frequency": "inmediata",
            },
            {
                "name": "Mencion negativa",
                "trigger": f'"{brand}" + palabras negativas (problema, error, queja)',
                "priority": "critica",
                "frequency": "inmediata",
            },
            {
                "name": "Comparacion competitiva",
                "trigger": f'"{brand}" + vs, alternativa, mejor que',
                "priority": "media",
                "frequency": "diaria",
            },
            {
                "name": "Mencion en IA",
                "trigger": f"Aparicion de {brand} en respuestas de ChatGPT/Perplexity",
                "priority": "alta",
                "frequency": "semanal",
            },
        ]

    def _check_visibility_signals(self, soup: BeautifulSoup, brand: str) -> list:
        signals = []

        # Social media links
        social_domains = ["twitter.com", "x.com", "linkedin.com", "facebook.com", "instagram.com", "youtube.com"]
        social_found = []
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            for sd in social_domains:
                if sd in href:
                    social_found.append(sd.replace(".com", ""))
                    break

        signals.append({
            "name": "Presencia en redes sociales",
            "status": "pass" if len(social_found) >= 3 else "warning" if len(social_found) >= 1 else "fail",
            "detail": f"Encontrados: {', '.join(set(social_found))}" if social_found else "Sin links a redes sociales",
        })

        # Contact info
        email_pattern = soup.find(string=lambda t: t and "@" in t and "." in t) if soup.find("body") else None
        signals.append({
            "name": "Informacion de contacto",
            "status": "pass" if email_pattern else "warning",
            "detail": "Email encontrado en la pagina" if email_pattern else "Sin email visible",
        })

        # Press/Media page
        press_links = [a for a in soup.find_all("a", href=True)
                       if any(w in a.get_text(strip=True).lower() for w in ["press", "prensa", "media", "noticias"])]
        signals.append({
            "name": "Seccion de prensa/media",
            "status": "pass" if press_links else "fail",
            "detail": "Pagina de prensa encontrada" if press_links else "Sin seccion de prensa - dificulta cobertura mediatica",
        })

        return signals

    def _calculate_score(self, signals: list) -> int:
        if not signals:
            return 50
        total = len(signals)
        passed = sum(1 for s in signals if s["status"] == "pass")
        warned = sum(1 for s in signals if s["status"] == "warning")
        return round(((passed + warned * 0.5) / total) * 100)

    def _error_result(self, url: str, error: str) -> dict:
        return {
            "url": url, "brand": "", "domain": "",
            "brand_keywords": [], "monitoring_queries": [],
            "channels": [], "alert_rules": [],
            "visibility_signals": [], "score": 0,
        }
