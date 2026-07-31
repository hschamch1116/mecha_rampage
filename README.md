# 🤖 Mecha Rampage: Siege Walker V5

[![WebGL](https://img.shields.io/badge/WebGL-Three.js-orange.svg)](https://threejs.org/)
[![Physics](https://img.shields.io/badge/Physics-Cannon.js-blue.svg)](https://github.com/schteppe/cannon.js)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#라이선스)
[![AI Powered](https://img.shields.io/badge/AI-Codex%205.6%20Terra%20%7C%20Gemini%203.6%20Flash-purple.svg)](AI_UTILIZATION_DOC.md)

**Mecha Rampage: Siege Walker V5**는 브라우저에서 별도의 빌드 도구 설치 없이 즉시 구동되는 **고품질 3D 메카 액션 시뮬레이션 게임**입니다.

타이틀 화면의 리얼타임 지하 원형 리프트 상승 연출에서 시작하여, 격납고에서의 4슬롯 무장 세팅, 실시간 보행 테스트, 메카 부품 커스터마이징, 그리고 건물이 파괴되는 도심 전장에서의 적 메카 전투(Deathmatch / Capture The Flag)까지 하나의 매끄러운 흐름으로 전개됩니다.

---

## 📸 게임 미리보기 & 플레이 흐름

```
[ 1. 타이틀 화면 ] ──► 지하 샤프트 해치 개방 및 원형 리프트 메카 상승 연출
       │
[ 2. 격납고 (HANGAR) ] ──► 4슬롯 무기 장착 (Gatling, Cannon, Laser, Homing Missile)
       │
[ 3. 커스터마이저 ] ──► 파츠·색상·스냅 편집 & WALK TEST ▶ 실시간 제자리 보행 테스트
       │
[ 4. 작전 모드 선택 ] ──► DEATHMATCH (총력전) / CAPTURE THE FLAG (🚩 깃발 탈취전) 선택
       │
[ 5. 도심 전장 (BATTLE) ] ──► 건물 파괴, 픽업 습득, 피격 비네트/사운드 피드백 및 적 메카 AI 전투
```

1. **타이틀 (Title Cutscene)**: 지하 원형 샤프트에서 해치가 열리며 30m 아래에서 메카를 실은 대형 원형 리프트가 올라옵니다.
2. **무장 선택 (Hangar)**: 4개의 무기 슬롯에 원하는 주무기/서브무기를 선택하여 장착합니다.
3. **메카 커스터마이즈 & 걸어보기 테스트**: 어깨, 백팩, 팔, 하체 볼 조인트를 조절하고 **`WALK TEST ▶`** 버튼으로 실시간 보행 파라미터(`🦖 GAIT`)를 조절하며 보행 모션을 테스트합니다.
4. **작전 모드 선택 (Operation Mode)**: Deathmatch(데스매치) 또는 Capture The Flag(🚩 CTF 깃발 탈취전) 작전을 선택합니다.
5. **도시 출격 (Battle Start)**: 파괴 가능한 고층 빌딩과 차량이 있는 전장에 출격하여 적 메카 AI 및 픽업 요소를 활용해 전투를 벌입니다.

---

## 🎮 조작법 (Controls)

| 입력 키 | 기능 설명 |
| :--- | :--- |
| `W` `A` `S` `D` | 메카 지면 이동 / 공중 이동 (S 키 후진 시 상체 전방 정밀 조준 유지) |
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

## 🎯 작전 모드 (Operation Modes)

* **⚔️ DEATHMATCH (데스매치 모드)**: 전장의 적 메카 AI들과 총력전을 펼쳐 적을 파괴하고 포인트를 획득하는 정통 메카 전투 모드입니다.
* **🚩 CAPTURE THE FLAG (CTF 깃발 탈취전)**: 적진 깊숙이 침투하여 적의 깃발을 탈취한 후, 아군 기지로 무사히 수송하여 득점하는 전술 목표 달성 모드입니다.

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

## 🛠️ 메카 커스터마이즈 & 역관절 보행 튜닝 (Customization & Gait)

* **`WALK TEST ▶` 실시간 제자리 보행 테스트**: 커스터마이징 화면(`MECHA CUSTOM`)에서 버튼 하나로 메카를 실시간 제자리 보행시키며 보행 모션을 테스트할 수 있습니다.
* **`🦖 GAIT` 튜닝 패널**: 보행 속도, 보폭, 힙 스윙, 무릎 굽힘, 바운스, 허벅지/정강이 각도 및 롤/피치 수치를 실시간 슬라이더로 조정하고 테스트할 수 있습니다.
* **볼 조인트 편집**: 백팩, 양 팔, 서브 무기 소켓, 하체 링크의 위치 및 크기 조절.
* **통합 좌표계 스냅 연산**: 모든 파츠 스냅은 `Player Local → World → Part Parent Local` 변환 과정을 거쳐 처리되므로 서로 다른 부모 계층을 가진 파츠도 동일한 기준 좌표로 결합됩니다.
* **자동 저장 & JSON 내보내기 (`SAVE FILE` / `LOAD FILE`)**: 현재 설정한 메카 커스터마이즈 셋팅을 브라우저 `localStorage`에 자동 보관하거나 `mecha-preset.json` 파일로 내보내어 관리할 수 있습니다.

---

## 💥 부위 내구도 & 전장 파괴 물리 (Damage & Destruction)

플레이어와 적 메카는 **최대 HP 200, 실드 200, 에너지 200**을 보유하며, **부위별 내구도 System**이 적용됩니다.

* **다리(Leg) 파괴 (HP 0%)**: 지면 보행, 부스트 대시, 점프가 차단되며 **하체 차체 회전(Rotation)까지 완전 잠금(Lock)**되어 이동 및 차체 회전이 완전 무력화됩니다. (상체 피벗 조준만 가능)
* **팔(Arm) 파괴 (HP 0%)**: 해당 측면의 팔 파츠가 유닛에서 탈락·폭발하며, 장착된 무기 발사가 비활성화됩니다.
* **몸통(Torso) 파괴 (HP 0%)**: 메카 유닛 전체가 폭발 파티클과 함께 파괴 처리됩니다.
* **2D 원형 스플래시 & 건물 파괴**: 폭발 시 2D 수평 원형 반경(`getRadialFalloff`) 스플래시 연산이 적용되어 주변 건물 27m 유리창이 산산조각나며 표면 블록이 파손됩니다.
* **밝은톤 그레이 분진 스모그**: 건물 붕괴 시 화려하고 웅장한 **밝은 라이트 그레이 톤 분진 먼지 구름**(`0xe8e4df`, `0xd8d4cf`) 및 거대한 낙하 폭발 충격파가 연출됩니다.

---

## 🔊 시각 효과 & 피격 사운드 엔진 (Visuals & Audio)

* **피격(Damage Taken) 사운드 및 피격 비네트 시스템**:
  * **웹 오디오 메탈 타격음 (`playPlayerHitSound`)**: 피해를 입을 때 묵직한 메탈 충격음 및 방어막 전격 사운드가 즉각 연주되어 피격 여부를 명확히 인지.
  * **피해량 비례 붉은색 비네트 플래시 (`#hitFlashOverlay`)**: 약한 타격은 은은하고 깔끔하게(`opacity: 0.15~0.35`), 대형 폭발 및 위기 시에는 강렬한 크림슨 레드 비네트(`.heavy`)와 카메라 셰이크가 작동.
* **VISUAL SETTINGS & 환경 효과**:
  * **Rain & Wet Surfaces**: 카메라를 따라오는 GPU 인스턴스 빗줄기와 젖은 지면·도로의 색상 및 반사 강도를 실시간 조절.
  * **Pooled Explosion & Instanced Glass**: 파편과 창문 유리를 `InstancedMesh` 풀로 통합 렌더링하여 프레임 드롭을 방지.

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
├── js/
│   ├── mecha-gait-controller.js  # T-Rex 역관절 보행 IK 컨트롤러 & 실시간 튜닝
│   ├── audio-manager.js          # Web Audio / Kenney SFX 사운드 관리자
│   └── flag.js                   # CTF 모드 깃발 및 기지 오브젝트 관리 모듈
├── weapon-system.js       # 무기 프로필 (Gatling, Cannon, Laser, Homing) 데이터 정의
├── enemy-ai.js            # 적 메카 AI (FSM, 픽업 추적, 건물 엄폐, 부위 파괴 반응)
├── mecha-rigidbody.js     # Cannon.js 물리 동기화 보조 모듈
├── cannon-physics.js      # 파편 physics, 탄피 배출 및 충돌 반응 보조
├── level1-map.js          # 레벨 1 도시 맵 레이아웃 데이터
├── run-server.bat         # Windows 원클릭 로컬 Web 서버 실행 스크립트
├── AI_UTILIZATION_DOC.md  # 📄 AI 활용 및 개발 내역 세부 기술 문서
└── assets/                # BGM 및 Kenney 사운드 리소스 폴더
```

---

## 📝 최근 변경 이력 (Changelog)

### 2026-07-31 V5.2 Update
* **`WALK TEST ▶` 커스텀 실시간 보행 테스트 추가**: 커스텀 화면에서 메카를 제자리 보행시키며 `🦖 GAIT` 파라미터를 실시간 테스트하는 기능 추가.
* **피격(Damage Taken) 사운드 및 가변 비네트 적용**: 피격 시 메탈 충격음 연주 및 피해 크기에 비례한 은은한/강렬한 붉은색 비네트 플래시 피드백 연동.
* **작전 모드 선택 확장 (Deathmatch & CTF)**: 데스매치와 Capture The Flag(🚩 깃발 탈취전) 모드 선택 지원 및 모드 선택/출격 사운드 깔끔 무음화.
* **후진 보행(`S` 키) 조준 정밀화**: 뒷걸음질 시 하체가 뒤돌지 않고 전방 조준선(`yaw`)을 유지하여 상체/무기 조준선 100% 정렬.
* **다리 100% 파괴 시 하체 회전(Rotation) 잠금**: 다리파츠 HP 0% 시 이동 및 하체 회전이 완전 무력화(Lock)되도록 밸런스 조정.
* **원형 2D 스플래시 & 라이트 그레이 붕괴 먼지**: 2D 원형 폭발 스플래시 연산 및 건물 붕괴 시 화려하고 밝은 톤의 라이트 그레이 분진 연출.
* **라운드 2 및 리스폰 조인트 꼬임 방지**: 텔레포트/리스폰 시 IK 스테이트 완전 초기화 로직 구현.

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
