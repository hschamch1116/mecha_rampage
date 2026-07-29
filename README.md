# 🤖 Mecha Rampage: Siege Walker V5

[![WebGL](https://img.shields.io/badge/WebGL-Three.js-orange.svg)](https://threejs.org/)
[![Physics](https://img.shields.io/badge/Physics-Cannon.js-blue.svg)](https://github.com/schteppe/cannon.js)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#라이선스)
[![AI Powered](https://img.shields.io/badge/AI-Codex%205.6%20Terra%20%7C%20Gemini%203.6%20Flash-purple.svg)](AI_UTILIZATION_DOC.md)

**Mecha Rampage: Siege Walker V5**는 브라우저에서 별도의 빌드 도구 설치 없이 즉시 구동되는 **고품질 3D 메카 액션 시뮬레이션 게임**입니다.

타이틀 화면의 리얼타임 지하 원형 리프트 상승 연출에서 시작하여, 격납고에서의 4슬롯 무장 세팅 및 메카 부품 커스터마이징, 그리고 건물이 파괴되는 도심 전장에서의 적 메카 전투까지 하나의 매끄러운 흐름으로 전개됩니다.

---

## 📸 게임 미리보기 & 플레이 흐름

```
[ 1. 타이틀 화면 ] ──► 지하 샤프트 해치 개방 및 원형 리프트 메카 상승 연출
       │
[ 2. 격납고 (HANGAR) ] ──► 4슬롯 무기 장착 (Gatling, Cannon, Laser, Homing Missile)
       │
[ 3. 커스터마이저 ] ──► 볼 조인트·파츠·색상·형상 편집 및 소켓 스냅 저장
       │
[ 4. 도심 전장 (BATTLE) ] ──► 건물 파괴, 픽업 습득, 적 메카 AI와 실시간 조준 사격 전투
```

1. **타이틀 (Title Cutscene)**: 지하 원형 샤프트에서 해치가 열리며 30m 아래에서 메카를 실은 대형 원형 리프트가 올라옵니다.
2. **무장 선택 (Hangar)**: 4개의 무기 슬롯에 원하는 주무기/서브무기를 선택하여 장착합니다.
3. **메카 커스터마이즈 (Customize)**: 어깨, 백팩, 팔, 하체 볼 조인트를 조절하고 장갑 색상 및 형상을 자유롭게 편집합니다.
4. **도시 출격 (Battle Start)**: 파괴 가능한 고층 빌딩과 차량이 있는 전장에 출격하여 적 메카 AI 및 픽업 요소를 활용해 전투를 벌입니다.

---

## 🎮 조작법 (Controls)

| 입력 키 | 기능 설명 |
| :--- | :--- |
| `W` `A` `S` `D` | 메카 지면 이동 / 공중 이동 |
| **마우스 이동** | 조준선 및 카메라 시점 회전 |
| `Shift` | 부스트 (고속 대시 이동) |
| `Space` | 점프 / 공중 유지 (홀드 시 상승 및 비행) |
| `Ctrl` 또는 `C` | 공중 하강 (강하) |
| **마우스 좌클릭** | 오른팔 무기 사격 |
| **마우스 우클릭** | 왼팔 무기 사격 |
| `1` ~ `4` | 4슬롯 무장 프리셋 전환 |
| `V` | 1인칭(FPV) / 3인칭(TPV) 시점 전환 |
| `P` | 게임 일시정지 (Pause) / 메뉴 |
| `F` | 프리 카메라 (Free Camera) ON/OFF (전장 멈춤 후 자유 비행 탐색) |
| `R` | 전장 재시작 |
| `Esc` / 전장 클릭 | 마우스 포인터 잠금 (Pointer Lock) 전환 |

---

## ⚔️ 무기 시스템 (Weapons System)

게임 내에는 총 4종의 고유한 무장 프로필이 존재하며, 각 무기는 전술적 역할과 물리 특성이 다릅니다.

| 무기명 | 아이콘 / 색상 | 피해량 | 발사 속도 | 사거리 | 특수 기능 및 탄도 연산 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Gatling** | 🟡 Yellow | 2.4 | 연사 (0.075초) | 82m | 근거리 다연사 직격탄 |
| **Heavy Cannon** | 🟠 Orange | 14.0 | 단발 (0.34초) | 92m | 범위 폭발(Splash) 피해 및 구조물 파괴 특화 |
| **Laser Cannon** | 🔴 Red | 2.0 | 지속 에너지 빔 | 90m | 즉시 탄도 직사 히트스캔 빔 사격 |
| **Homing Missile** | 🟢 Green | 13.0 | 유도 (0.90초) | 105m | 다발 유도 미사일, **건물 엄폐 시 유도 해제 (LOS Raycasting)** |

> 💡 **호밍 미사일 건물 엄폐 물리 (Homing LOS Raycasting)**  
> 단순한 글로벌 시야 체크가 아닌, **각 미사일의 개별 위치에서 타겟 메카까지의 시야 경로**를 매 프레임 실시간 레이캐스팅합니다. 타겟이 건물 뒤로 숨으면 미사일의 유도가 해제되어 벽을 뚫고 꺾이지 않고 관성 비행합니다.

---

## 🛠️ 메카 커스터마이즈 & 스냅 시스템 (Customization)

* **볼 조인트 편집**: 백팩, 양 팔, 서브 무기 소켓, 하체 링크의 위치 및 크기 조절.
* **통합 좌표계 스냅 연산**: 모든 파츠 스냅은 `Player Local → World → Part Parent Local` 변환 과정을 거쳐 처리되므로 서로 다른 부모 계층을 가진 팔·무기·백팩도 동일한 기준 좌표로 결합됩니다.
* **부위별 숨김(Hide) 조절**: 선택한 볼 조인트나 파츠를 숨기거나 표시할 수 있으며, 이 정보는 브라우저 저장 데이터에 유지됩니다.
* **자동 저장 (`localStorage`)**: **APPLY** 버튼 클릭 시 브라우저 `localStorage`에 저장되어 재접속 시 자동 적용됩니다.
* **JSON 파일 저장 및 불러오기 (`SAVE FILE` / `LOAD FILE`)**:
  * **`SAVE FILE` (SAVE FILE)**: 현재 설정한 메카 커스터마이즈 셋팅을 `mecha-preset.json` 파일로 내보내어 다운로드합니다.
  * **`LOAD FILE` (LOAD FILE)**: PC에 저장해둔 `.json` 프리셋 파일을 선택하여 커스텀 셋팅을 즉시 로드하고 적용합니다.
  * **`mecha-preset.json` 제공**: 기본 프로젝트 내에 사전 구성된 프리셋 파일이 포함되어 있어 매번 설정할 필요가 없습니다.

---

## 💥 부위 내구도 & 전장 파괴 물리 (Damage & Destruction)

플레이어와 적 메카는 **최대 HP 200, 실드 200, 에너지 200**을 보유하며, **부위별 내구도 System**이 적용됩니다.

* **다리(Leg) 파괴 (HP 0%)**: 메카의 지면 보행, 부스트 대시, 점프 및 공중 비행이 차단됩니다.
* **팔(Arm) 파괴 (HP 0%)**: 해당 측면의 팔 파츠가 유닛에서 탈락·폭발하며, 장착된 무기 발사가 비활성화됩니다.
* **몸통(Torso) 파괴 (HP 0%)**: 메카 유닛 전체가 폭발 파티클과 함께 파괴 처리됩니다.
* **파괴 가능한 도시 환경**: 고층 빌딩 블록, 유리의 산산조각 붕괴 연출, 붕괴 먼지 파티클, 도로의 차량 및 가로등 충돌 물리.

---

## 🔊 시각 효과 & 사운드 엔진 (Visuals & Audio)

* **VISUAL SETTINGS**:
  * **Bloom & Exposure**: 광원 효과 및 화면 노출도 실시간 조절 (기본 블룸 `0.2`, 노출 `1.2`).
  * **Window Shaders**: 도시 건물의 유리창 색상, 투명도(`0.9`), 어두움, 러프니스 설정.
  * **Environment Reflections**: 전장 반사 프로브 강도(`3.0`) 및 포스트 이펙트 적용.
  * **Rain & Wet Surfaces**: 카메라를 따라오는 GPU 인스턴스 빗줄기와 젖은 지면·도로·보도의 색상 및 반사 강도를 `RAIN` 슬라이더로 실시간 조절.
  * **Pooled Explosion Particles**: 폭발 연기와 스파크를 고정 크기 `InstancedMesh` 배치로 렌더링하고 폭발·화염 오브젝트를 사전 생성 풀에서 재사용해 전투 중 생성 프레임 드롭을 억제.
  * **Instanced Building Glass**: 외벽 창문과 로비 양문·상부 유리 바를 건물별 단일 동적 `InstancedMesh`로 통합하며, 피격 시 해당 창문 인스턴스만 비활성화.
  * **Title Mecha Orbit Camera**: 타이틀 배경을 좌우로 드래그해 메카 주변을 제한된 각도로 회전하며, 카메라는 상승 중인 메카를 추적하고 화면 왼쪽 구도를 유지.
  * **Industrial Hangar Reveal**: 타이틀 리프트 해치를 샤프트 내부의 반원형 양문으로 바꿔 좌우 레일을 따라 열리게 했으며, 정비 로봇팔에는 앵커 플레이트·회전 링·각진 하우징·유압 피스톤·스캐너를 추가.
  * **Deep Lift & Service Drones**: 반원형 해치의 분할 축을 좌우 슬라이드에 맞게 바로잡고, 리프트 시작점을 샤프트 아래로 더 깊게 이동. 수리 빔 대신 툴 헤드 스파크만 남기고, 소형 자율 수송 로봇 3대가 격납고를 순찰.
  * **GPU Fracture Culling**: 건물·유리·차량 파편과 붕괴 먼지를 고정 용량 `InstancedMesh` 풀로 통합. 카메라 거리 밖에서는 생성·갱신을 생략하며, 파편마다 새 물리 바디와 GPU 리소스를 만들지 않음.
  * **Angular Mecha Optimization**: 메카의 라운드 아머를 공유되는 각진 지오메트리로 전환하고, 미세 트림의 그림자 패스를 컬링. 관절별 정적 디테일은 병합해 외형을 유지하면서 메시·드로우콜을 줄였으며, 우측 상단 FPS 패널에서 프레임 시간과 드로우콜을 확인 가능.
  * **Hangar Shadows & Static Batching**: 격납고의 키·상부 스포트라이트에 제한된 1024px 그림자 맵을 적용. 파괴 계약과 창문 인스턴스는 그대로 두고, 정적 외벽 장식·도로 디테일·미래 배경만 호환되는 지오메트리끼리 병합해 메시 수를 절감.
  * **Film Grain Grade**: CRT 스캔라인은 제거하고, 후처리 단계에 미세한 컬러 필름 그레인만 적용.
  * **Startup Loading Gate**: 렌더러·격납고·도시 초기화 단계를 표시하고, 실제 첫 두 프레임이 그려진 뒤에만 타이틀 화면을 노출.
  * **Booster & Hangar FX**: 부스터에 고온 코어·외곽 플룸·배기 연기 입자를 겹쳐 적용하고, 격납고 벽면에 회전하는 산업용 환풍기 6기를 배치.
  * **Hip-Synced Reverse Gait**: 양쪽 고관절의 평균 이동을 골반 장갑에 전달해 관절이 분리되어 보이지 않게 하고, 공중에 든 발만 중심 방향으로 짧게 옮겨 무거운 보행감을 유지.
  * **Seeded Building PCG**: 도로와 전장 충돌 경계는 고정한 채, 위치별 시드로 층수·기초 폭·테이퍼 실루엣·외장 팔레트·네온/간판 변형을 생성. 현재 검토 모드에서는 투명 유리창 인스턴스와 구조 코어만 유지하고, 개별 파괴 외벽 패널은 비활성화. 유리는 광선·투사체에 직접 피격되면 인스턴스가 제거되고 조각 파티클이 발생하며, 파워 샷은 레벨에 비례한 반경과 개수로 주변 창을 연쇄 파손.
* **Audio Engine (`audio-manager.js`)**:
  * Kenney 사운드 팩 기반 3D 공간 사운드 효과 (무기 사격, 사운드 믹스, 충돌, 로봇 도크 개방음).
  * 배경 음악: `assets/title-hangar-bgm.mp3` (타이틀/격납고 루프 BGM).
  * 브라우저 자동 재생 정책을 준수한 첫 인터랙션 사운드 활성화 구조.

---

## ⚡ 빠른 실행 방법 (Getting Started)

본 프로젝트는 외부 패키지 설치나 별도의 컴파일/빌드 과정이 필요 없는 정적 프로젝트입니다.

### Windows 실행 (권장)

프로젝트 루트 폴더의 `run-server.bat`을 실행하거나 PowerShell / CMD에서 다음 명령을 실행합니다.

```powershell
# Python 3가 설치되어 있는 경우
py -m http.server 8080
```

서버 실행 후 브라우저 주소창에 **[http://localhost:8080](http://localhost:8080)** 접속.

> ⚠️ `file://` 직접 로드 방식은 브라우저의 CORS 및 Audio API 제한이 발생할 수 있으므로, 상기 로컬 HTTP 서버 실행을 강력히 권장합니다.

---

## 📁 프로젝트 구조 (Project Architecture)

```text
mecha_rampage_siege_walker_v5/
├── index.html             # 메인 3D 루프, UI HUD, 격납고 cutscene, 파괴 물리 렌더러
├── mecha-character.js     # 메카 메쉬 생성, 소켓 스냅 좌표 연산, 커스터마이저 데이터 병합
├── weapon-system.js       # 무기 프로필 (Gatling, Cannon, Laser, Homing) 데이터 정의
├── enemy-ai.js            # 적 메카 AI (FSM, 픽업 추적, 건물 엄폐, 부위 파괴 반응)
├── mecha-rigidbody.js     # Cannon.js 물리 동기화 보조 모듈
├── cannon-physics.js      # 파편 physics, 탄피 배출 및 충돌 반응 보조
├── level1-map.js          # 레벨 1 도시 맵 레이아웃 데이터
├── audio-manager.js       # Web Audio / Kenney SFX 사운드 관리자
├── run-server.bat         # Windows 원클릭 로컬 Web 서버 실행 스크립트
├── AI_UTILIZATION_DOC.md  # 📄 AI 활용 및 개발 내역 세부 기술 문서
└── assets/                # BGM 및 Kenney 사운드 리소스 폴더
```

---

## 🤖 AI 활용 내역 (AI Utilization)

본 프로젝트는 **Antigravity AI Agent** 환경에서 **Codex 5.6 Terra** (기본 베이스 모델)와 **Gemini 3.6 Flash** (추론 및 리팩토링 엔진)의 멀티 모델 협업으로 개발되었습니다.

* **기본 코드 및 아키텍처 구축**: **Codex 5.6 Terra**를 통한 모듈 구조화, Three.js 3D 오브젝트, 사운드 및 AI 기본 뼈대 작성.
* **3D 공간 행렬 연산 연동**: **Gemini 3.6 Flash**를 통한 중첩된 Three.js 메쉬 계층 구조에서의 소켓 스냅 알고리즘 자동 도출.
* **스마트 적 AI & 물리 디버깅**: 89KB 규모의 적 메카 행동 트리, 픽업 추적 알고리즘, 건물 엄폐 호밍 미사일 레이캐스팅 및 부위별 파괴 시스템 구축.

자세한 AI 활용 내역, 프롬프트 이력, 개발 생산성 지표는 **[AI_UTILIZATION_DOC.md](AI_UTILIZATION_DOC.md)** 문서에서 확인하실 수 있습니다.

---

## 📝 변경 이력 (Changelog)

### 2026-07-28 Patch Update
* **프리 카메라 (Free Camera) 및 전장 시간정지**: 전투 중 `F` 키를 누르면 시뮬레이션이 멈추고 3D 공간을 자유 비행(`WASD`/`Space`/`Ctrl`/`Shift`)하며 전장을 탐색할 수 있습니다.
* **메카 커스텀 JSON 파일 저장 & 불러오기 (`SAVE FILE` / `LOAD FILE`)**: 현재 설정한 메카 커스텀 셋팅을 `mecha-preset.json` 파일로 내보내거나 기존 셋팅 파일을 즉시 불러와 적용할 수 있습니다.
* **마우스 드래그 폰트 선택 차단**: 게임 화면 및 HUD에서 마우스 드래그 시 텍스트/폰트 하이라이트가 발생하지 않도록 `-webkit-user-select: none` 및 `selectstart` 차단 처리.

### 2026-07-27 Patch Update
* **지하 원형 리프트 컷씬 추가**: 타이틀 연출을 지하 원형 샤프트 상승 장면으로 전환 및 중앙 샤프트 Ring Geometry 적용.
* **호밍 미사일 건물 엄폐 (LOS) 개선**: 개별 미사일 위치 기준 레이캐스팅 추가로 건물 뒤 숨은 타겟 유도 차단.
* **볼 조인트 & 소켓 스냅 동기화**: 파츠 선택 시 연결 조인트 동기화 및 부모 행렬 인버스 변환 적용.
* **부위 파괴 게임플레이 피드백**: 다리 파괴 시 이동 차단, 팔 파괴 시 무기 이탈/비활성화, 몸통 파괴 시 전체 폭발 연출.
* **HUD 및 HP 시스템 확장**: 최대 HP/실드/에너지 200 확장 및 HUD 게이지 보정.

---

## 📜 라이선스 (License)

본 프로젝트의 소스 코드는 MIT 라이선스를 따르며, 사용된 사운드 리소스(Kenney Asset) 및 3D 그래픽 라이브러리(Three.js, Cannon.js)는 각각의 오픈소스 라이선스 규정을 준수합니다.
