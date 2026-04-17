FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치
# libreoffice: Office 문서(docx/xlsx/pptx/odt 등) → PDF 변환 (증적 미리보기)
# fonts-noto-cjk: 한글/CJK 문서 렌더링용 폰트
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libreoffice \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 로그 디렉토리 생성
RUN mkdir -p /app/logs

# 포트 노출
EXPOSE 8000

# 기본 명령어 (docker-compose에서 오버라이드됨)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
