## 9. Browser Automation 명령

### 9.1 Navigation

```bash
cmux browser open <url>                          # 브라우저 서피스 열기
cmux browser open-split <url>                    # 분할로 열기
cmux browser <surface> navigate <url> [--snapshot-after]
cmux browser <surface> back
cmux browser <surface> forward
cmux browser <surface> reload [--snapshot-after]
cmux browser <surface> url                       # 현재 URL 조회
cmux browser identify [--surface <id>]           # 브라우저 서피스 식별
```

### 9.2 Waiting

```bash
cmux browser <surface> wait --load-state complete --timeout-ms 15000
cmux browser <surface> wait --selector "#checkout" --timeout-ms 10000
cmux browser <surface> wait --text "Order confirmed"
cmux browser <surface> wait --url-contains "/dashboard"
cmux browser <surface> wait --function "window.__appReady === true"
```

### 9.3 DOM Interaction

```bash
cmux browser <surface> click "selector" [--snapshot-after]
cmux browser <surface> dblclick "selector"
cmux browser <surface> hover "selector"
cmux browser <surface> focus "selector"
cmux browser <surface> check "selector"
cmux browser <surface> uncheck "selector"
cmux browser <surface> scroll-into-view "selector"
cmux browser <surface> type "selector" "text"
cmux browser <surface> fill "selector" --text "value"
cmux browser <surface> press Enter
cmux browser <surface> select "selector" "value"
cmux browser <surface> scroll --dy 800 [--snapshot-after]
```

### 9.4 Inspection

```bash
# 스냅샷 (DOM 구조)
cmux browser <surface> snapshot --interactive --compact
cmux browser <surface> snapshot --selector "main" --max-depth 5

# 스크린샷
cmux browser <surface> screenshot --out /tmp/page.png

# 값 조회
cmux browser <surface> get title
cmux browser <surface> get url
cmux browser <surface> get text "selector"
cmux browser <surface> get html "selector"
cmux browser <surface> get value "selector"
cmux browser <surface> get attr "selector" --attr href
cmux browser <surface> get count "selector"
cmux browser <surface> get box "selector"
cmux browser <surface> get styles "selector" --property color

# 상태 확인
cmux browser <surface> is visible "selector"
cmux browser <surface> is enabled "selector"
cmux browser <surface> is checked "selector"

# 요소 찾기
cmux browser <surface> find role button --name "Continue"
cmux browser <surface> find text "Order confirmed"
cmux browser <surface> find label "Email"
cmux browser <surface> find testid "save-btn"

# 하이라이트
cmux browser <surface> highlight "selector"
```

### 9.5 JavaScript

```bash
cmux browser <surface> eval "document.title"
cmux browser <surface> eval --script "window.location.href"
cmux browser <surface> addinitscript "window.__ready = true;"
cmux browser <surface> addscript "document.querySelector('#btn')?.click()"
cmux browser <surface> addstyle "#banner { display: none !important; }"
```

### 9.6 Cookies / Storage / State

```bash
# Cookies
cmux browser <surface> cookies get [--name <name>]
cmux browser <surface> cookies set <name> <value> --domain <d> --path /
cmux browser <surface> cookies clear [--name <name> | --all]

# Storage
cmux browser <surface> storage local set <key> <value>
cmux browser <surface> storage local get <key>
cmux browser <surface> storage local clear
cmux browser <surface> storage session set <key> <value>

# 전체 상태 저장/복원
cmux browser <surface> state save /tmp/state.json
cmux browser <surface> state load /tmp/state.json
```

### 9.7 Tabs / Console / Errors / Dialogs / Downloads

```bash
# 탭
cmux browser <surface> tab list
cmux browser <surface> tab new <url>
cmux browser <surface> tab switch <index|surface_id>
cmux browser <surface> tab close [surface_id]

# 콘솔/에러
cmux browser <surface> console list
cmux browser <surface> console clear
cmux browser <surface> errors list
cmux browser <surface> errors clear

# 다이얼로그
cmux browser <surface> dialog accept ["text"]
cmux browser <surface> dialog dismiss

# iframe
cmux browser <surface> frame "selector"
cmux browser <surface> frame main

# 다운로드
cmux browser <surface> download --path /tmp/file.csv --timeout-ms 30000
```

---

