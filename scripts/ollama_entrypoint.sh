#!/bin/sh
# Ollama 컨테이너 entrypoint.
#
# 1. `ollama serve` 를 백그라운드로 띄운다.
# 2. 서버가 응답할 때까지 기다린 뒤, 필요한 모델이 없으면 pull 한다.
# 3. 모델이 준비되면 foreground 프로세스(serve)를 wait 으로 점유한다.
#
# 이 구조는 `docker compose up -d` 를 아무것도 없는 호스트에서 실행해도
# 자동으로 모델을 받아오게 하여, 사용자 메모리 규칙("Docker 재설치 시 자동
# 적용되어야 함")을 만족시킨다. 이미 받은 모델이 있으면 pull 은 no-op 이다.
set -e

MODEL="${LLM_MODEL:-qwen2.5vl:3b}"

echo "[ollama-entrypoint] starting ollama serve (target model: $MODEL)"
ollama serve &
SERVE_PID=$!

# 서버가 listening 할 때까지 대기 (최대 ~30초)
for i in $(seq 1 30); do
    if ollama list >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! ollama list >/dev/null 2>&1; then
    echo "[ollama-entrypoint] ERROR: ollama serve did not become ready" >&2
    exit 1
fi

# 모델이 이미 있는지 확인 (태그까지 포함하여 정확 일치)
if ollama list | awk 'NR>1{print $1}' | grep -Fxq "$MODEL"; then
    echo "[ollama-entrypoint] model $MODEL already present — skipping pull"
else
    echo "[ollama-entrypoint] pulling $MODEL (first-time download may take several minutes)"
    if ! ollama pull "$MODEL"; then
        echo "[ollama-entrypoint] WARNING: pull failed; container will keep running so you can retry manually" >&2
    fi
fi

echo "[ollama-entrypoint] ready — handing off to ollama serve (pid $SERVE_PID)"
wait "$SERVE_PID"
