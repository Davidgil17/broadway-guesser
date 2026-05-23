from fastapi import FastAPI
from .routers.game import router

app = FastAPI()
app.include_router(router)
