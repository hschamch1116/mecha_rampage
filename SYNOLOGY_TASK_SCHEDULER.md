# Synology NAS 작업 스케줄러 - Node 서버

이 프로젝트를 Synology NAS에서 Node.js 기본 모듈만으로 정적 HTTP 서버로 실행하는 안내입니다.

- NAS 프로젝트 경로: `/volume1/docker/mecha_rampage_siege_walker_v5`
- 서버 파일: `server.js`
- 기본 포트: `8080`
- 접속 주소: `http://NAS_IP:8080/`
- 외부 패키지: 없음 (`npm install` 불필요)

## 1. NAS 폴더 확인

NAS 프로젝트 루트에 다음 파일과 폴더가 있어야 합니다.

```text
/volume1/docker/mecha_rampage_siege_walker_v5/index.html
/volume1/docker/mecha_rampage_siege_walker_v5/server.js
/volume1/docker/mecha_rampage_siege_walker_v5/js/
/volume1/docker/mecha_rampage_siege_walker_v5/assets/
```

## 2. Node.js 경로 확인

SSH로 NAS에 접속해 실행합니다.

```sh
command -v node
node --version
```

결과로 나온 경로를 기억합니다. 예시는 다음과 같습니다.

```text
/usr/local/bin/node
```

Synology Docker 컨테이너에서 실행한다면 해당 컨테이너 안에서 `node --version`을 확인해야 합니다.

## 3. DSM 작업 스케줄러 생성

DSM에서 다음 순서로 이동합니다.

```text
제어판 → 작업 스케줄러 → 생성 → 예약된 작업 → 사용자 정의 스크립트
```

권장 설정:

- 작업 이름: `Mecha Rampage Node Server`
- 사용자: 프로젝트 폴더를 읽을 수 있는 계정
- 일정: `부트업`
- 권한 문제가 있을 때만 root로 테스트

## 4. 부팅 시 Node 서버 실행

작업 스케줄러의 사용자 정의 스크립트에 입력합니다.

아래에서 `NODE_BIN`은 실제 `command -v node` 결과로 바꿉니다.

```sh
#!/bin/sh

PROJECT_DIR="/volume1/docker/mecha_rampage_siege_walker_v5"
NODE_BIN="/usr/local/bin/node"
PORT="8080"
LOG_DIR="$PROJECT_DIR/logs"
PID_FILE="$LOG_DIR/mecha-rampage-node.pid"
LOG_FILE="$LOG_DIR/mecha-rampage-node.log"

mkdir -p "$LOG_DIR"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Project directory not found" >> "$LOG_FILE"
  exit 1
fi

if [ ! -x "$NODE_BIN" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Node not found: $NODE_BIN" >> "$LOG_FILE"
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Already running. PID=$OLD_PID" >> "$LOG_FILE"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$PROJECT_DIR" || exit 1

PORT="$PORT" MECHA_ROOT="$PROJECT_DIR" \
  nohup "$NODE_BIN" "$PROJECT_DIR/server.js" \
  >> "$LOG_FILE" 2>&1 < /dev/null &

SERVER_PID="$!"
echo "$SERVER_PID" > "$PID_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Started. PID=$SERVER_PID PORT=$PORT" >> "$LOG_FILE"
```

`server.js`는 `0.0.0.0:8080`에 바인딩하므로 같은 LAN의 PC나 모바일에서 NAS IP로 접속할 수 있습니다.

## 5. 실행 확인

```sh
cat /volume1/docker/mecha_rampage_siege_walker_v5/logs/mecha-rampage-node.pid
ps | grep '[n]ode.*server.js'
netstat -an | grep 8080
tail -n 50 /volume1/docker/mecha_rampage_siege_walker_v5/logs/mecha-rampage-node.log
```

브라우저에서 접속합니다.

```text
http://NAS_IP:8080/
```

예시:

```text
http://192.168.0.20:8080/
```

## 6. 수동 중지 스크립트

별도의 사용자 정의 스크립트 작업으로 저장해 필요할 때 수동 실행합니다.

```sh
#!/bin/sh

PROJECT_DIR="/volume1/docker/mecha_rampage_siege_walker_v5"
PID_FILE="$PROJECT_DIR/logs/mecha-rampage-node.pid"
LOG_FILE="$PROJECT_DIR/logs/mecha-rampage-node.log"

if [ -f "$PID_FILE" ]; then
  SERVER_PID="$(cat "$PID_FILE")"
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Stopped. PID=$SERVER_PID" >> "$LOG_FILE"
  fi
  rm -f "$PID_FILE"
fi
```

## 7. 포트·방화벽 주의

- `8080` 포트를 다른 서비스가 사용하면 서버가 시작되지 않습니다.
- 포트 충돌 확인: `netstat -an | grep 8080`
- Synology 방화벽에서 TCP `8080`을 내부 LAN에만 허용하는 것을 권장합니다.
- 이 서버는 인증과 HTTPS가 없는 개발·테스트용 정적 서버입니다.
- 인터넷에 직접 공개하지 말고, 외부 공개가 필요하면 Synology Reverse Proxy와 HTTPS·인증을 별도로 구성합니다.

## 8. Node 서버로 바꾼 뒤의 장점

- Python 설치와 무관하게 실행할 수 있습니다.
- Node 기본 모듈만 사용하므로 npm 의존성이 없습니다.
- `GET`과 `HEAD` 요청, 기본 MIME 타입, 경로 탈출 방지를 처리합니다.
- 현재의 `index.html`, CDN import map, `js/`, `assets/` 구조를 그대로 유지합니다.

## 9. 권장 시작 파일 사용

제시한 Synology 운영 방식처럼 Node 경로를 여러 후보에서 찾고 `@appstore`를 fallback으로 검색하려면 프로젝트의 `synology-start-mecha.sh`를 사용합니다.

NAS에 다음 파일을 복사합니다.

```text
/volume1/docker/mecha_rampage_siege_walker_v5/synology-start-mecha.sh
```

DSM 작업 스케줄러에서는 사용자 정의 스크립트에 다음 한 줄만 입력해도 됩니다.

```sh
/bin/bash /volume1/docker/mecha_rampage_siege_walker_v5/synology-start-mecha.sh
```

이 시작 파일은 다음을 처리합니다.

- `/usr/bin/node`, `/usr/local/bin/node`, Node.js v16/v18/v20 패키지 경로 탐색
- `/volume1/@appstore/` 안의 Node fallback 탐색
- `server.js` 존재 여부 확인
- 기존 PID 확인 후 중복 실행 방지
- Node 서버 stdout/stderr 로그 저장
- PID 파일 저장

이 프로젝트에는 `better-sqlite3` 같은 npm 의존성이 없으므로 `npm install`을 자동 실행하거나 `node_modules`를 삭제하지 않습니다. NAS에서 파일을 갱신한 뒤에는 작업 스케줄러에서 기존 작업을 한 번 수동 실행해 로그를 확인합니다.
