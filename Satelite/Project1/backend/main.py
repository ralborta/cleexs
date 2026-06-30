from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from crawler import SiteCrawler

app = FastAPI(title="Cleexs Crawlability Checker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrawlRequest(BaseModel):
    url: str


class CrawlResponse(BaseModel):
    target_url: str
    pages_crawled: int
    total_links_found: int
    score: int
    issues: list
    pages: list
    summary: dict
    crawl_time: float


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/crawl", response_model=CrawlResponse)
async def crawl_site(request: CrawlRequest):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL es requerida")

    if not url.startswith("http"):
        url = "https://" + url

    crawler = SiteCrawler(max_pages=30, max_depth=3, timeout=10)
    try:
        result = await crawler.crawl(url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al rastrear: {str(e)}")

    return CrawlResponse(
        target_url=result.target_url,
        pages_crawled=result.pages_crawled,
        total_links_found=result.total_links_found,
        score=result.score,
        issues=result.issues,
        pages=result.pages,
        summary=result.summary,
        crawl_time=result.crawl_time,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
