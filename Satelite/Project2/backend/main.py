from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from analyzer import SiteAnalyzer, generate_recommended_robots

app = FastAPI(title="Cleexs Robots.txt & Sitemap Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str


class GenerateRobotsRequest(BaseModel):
    url: str
    allow_ai: bool = True


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_site(request: AnalyzeRequest):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL es requerida")

    if not url.startswith("http"):
        url = "https://" + url

    analyzer = SiteAnalyzer(timeout=10, max_crawl_pages=50)
    try:
        result = await analyzer.analyze(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al analizar: {str(e)}")

    return {
        "target_url": result.target_url,
        "robots": result.robots,
        "sitemap": result.sitemap,
        "generated_sitemap": result.generated_sitemap,
        "score": result.score,
        "analysis_time": result.analysis_time,
    }


@app.post("/api/generate-robots")
async def gen_robots(request: GenerateRobotsRequest):
    url = request.url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    from urllib.parse import urlparse
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    content = generate_recommended_robots(base_url, allow_ai=request.allow_ai)
    return {"content": content}


@app.post("/api/download-sitemap")
async def download_sitemap(request: AnalyzeRequest):
    url = request.url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    analyzer = SiteAnalyzer(timeout=10, max_crawl_pages=50)
    try:
        result = await analyzer.analyze(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    sitemap_xml = result.generated_sitemap
    if not sitemap_xml:
        raise HTTPException(status_code=404, detail="No se pudo generar el sitemap")

    return Response(
        content=sitemap_xml,
        media_type="application/xml",
        headers={"Content-Disposition": "attachment; filename=sitemap.xml"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
