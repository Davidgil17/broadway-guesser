FROM python:3.12-slim
WORKDIR /broadway
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY frontend/ ./frontend/
COPY seeds/ ./seeds/
ENV PYTHONPATH=/broadway
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
