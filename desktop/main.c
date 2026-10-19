/* ToDO-AKA — native Windows program. No browser, no console. */
#define WIN32_LEAN_AND_MEAN
#define _WIN32_IE 0x0600
#include <windows.h>
#include <commctrl.h>
#include <shlobj.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define COL_BG RGB(18, 17, 14)
#define COL_PANEL RGB(28, 27, 23)
#define COL_PANEL2 RGB(40, 38, 32)
#define COL_LINE RGB(62, 58, 48)
#define COL_CREAM RGB(244, 239, 230)
#define COL_MIST RGB(166, 158, 146)
#define COL_GOLD RGB(232, 163, 23)
#define COL_EMBER RGB(239, 93, 50)
#define COL_INK RGB(18, 17, 14)

#define MAX_CAT 48
#define MAX_TASK 400
#define MAX_SPAN 4000
#define SIDE 220

enum {
  HOT_NAV = 1, HOT_CAT, HOT_STOP, HOT_SCORE, HOT_NEW, HOT_TOGGLE, HOT_EDIT, HOT_SAVE, HOT_CANCEL, HOT_DEL, HOT_PRIO,
  HOT_P25, HOT_P50, HOT_PSTOP, HOT_PREV, HOT_NEXT, HOT_TODAY, HOT_ADD_CAT, HOT_REN_CAT, HOT_DEL_CAT, HOT_UNDO, HOT_DEL_SPAN
};
enum { PAGE_TODAY = 0, PAGE_TASKS, PAGE_TIME, PAGE_STATS, PAGE_CATS };

typedef struct { RECT r; int kind, a, b; } Hot;
typedef struct { int id; char title[240]; int done, priority; char deadline[16], created[20], completed[20]; } Task;
typedef struct { int id; char day[16], category[80]; long long start, end; int score; } Span;

static HINSTANCE gInst;
static HWND gWnd, gEdit, gDate;
static HFONT fontUi, fontBold, fontTitle, fontSmall;
static HBRUSH brushEdit;
static Hot hots[700];
static int nHot, hover = -1, page, pageScroll, pageMax;
static char cats[MAX_CAT][80];
static int nCat, nTask, nSpan, nextId = 1;
static Task tasks[MAX_TASK];
static Span spans[MAX_SPAN];
static int editing, editId, editPrio;
static char editCreated[20];
static int undoId, undoDone;
static DWORD undoAt;
static int pomoOn, pomoBreak, pomoLeft, pomoFull, pomoCount;
static DWORD pomoStamp;
static char pomoDay[16];
static int viewY, viewM, viewD, contentBottom;
static wchar_t dataPath[MAX_PATH];

static void save(void);
static void place_controls(void);

static void to_wide(const char* s, wchar_t* w, int n) { MultiByteToWideChar(CP_UTF8, 0, s ? s : "", -1, w, n); }
static void to_utf8(const wchar_t* w, char* s, int n) { WideCharToMultiByte(CP_UTF8, 0, w, -1, s, n, NULL, NULL); }
static void clean(char* s) { for (; *s; s++) if (*s == '\t' || *s == '\n' || *s == '\r') *s = ' '; }

static void day_of(time_t t, char* out) {
  struct tm tmv = *localtime(&t);
  sprintf(out, "%04d-%02d-%02d", tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday);
}
static void today_key(char* out) { day_of(time(NULL), out); }
static void stamp_now(char* out) {
  time_t t = time(NULL);
  struct tm tmv = *localtime(&t);
  sprintf(out, "%04d-%02d-%02d %02d:%02d", tmv.tm_year + 1900, tmv.tm_mon + 1, tmv.tm_mday, tmv.tm_hour, tmv.tm_min);
}
static void fmt_span(long long sec, char* out) {
  if (sec < 0) sec = 0;
  int h = (int)(sec / 3600), m = (int)((sec % 3600) / 60), s = (int)(sec % 60);
  if (h) sprintf(out, "%d:%02d:%02d", h, m, s);
  else sprintf(out, "%d:%02d", m, s);
}
static void fmt_hm(long long sec, char* out) {
  if (sec < 0) sec = 0;
  sprintf(out, "%d ч %02d м", (int)(sec / 3600), (int)((sec % 3600) / 60));
}
static void view_key(char* out) { sprintf(out, "%04d-%02d-%02d", viewY, viewM, viewD); }
static void set_view_today(void) {
  time_t t = time(NULL);
  struct tm tmv = *localtime(&t);
  viewY = tmv.tm_year + 1900; viewM = tmv.tm_mon + 1; viewD = tmv.tm_mday;
}
static void shift_view(int days) {
  struct tm tmv = {0};
  tmv.tm_year = viewY - 1900; tmv.tm_mon = viewM - 1; tmv.tm_mday = viewD + days; tmv.tm_hour = 12;
  mktime(&tmv);
  viewY = tmv.tm_year + 1900; viewM = tmv.tm_mon + 1; viewD = tmv.tm_mday;
}
static void ru_date(int y, int m, int d, char* out) {
  static const char* mon[] = {"января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"};
  static const char* wd[] = {"воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"};
  struct tm tmv = {0};
  tmv.tm_year = y - 1900; tmv.tm_mon = m - 1; tmv.tm_mday = d; tmv.tm_hour = 12;
  mktime(&tmv);
  sprintf(out, "%s, %d %s", wd[tmv.tm_wday], d, mon[m - 1]);
}
static int find_task(int id) { for (int i = 0; i < nTask; i++) if (tasks[i].id == id) return i; return -1; }
static int find_span(int id) { for (int i = 0; i < nSpan; i++) if (spans[i].id == id) return i; return -1; }
static Span* open_span(const char* day) {
  for (int i = 0; i < nSpan; i++) if (!spans[i].end && strcmp(spans[i].day, day) == 0) return &spans[i];
  return NULL;
}
static long long span_seconds(const Span* s) {
  long long end = s->end ? s->end : (long long)time(NULL);
  return end < s->start ? 0 : end - s->start;
}
static double day_score(const char* day, int* count) {
  int n = 0, sum = 0;
  for (int i = 0; i < nSpan; i++) if (spans[i].end && spans[i].score && strcmp(spans[i].day, day) == 0) { sum += spans[i].score; n++; }
  if (count) *count = n;
  return n ? (double)sum / n : 0;
}
static void default_cats(void) {
  const char* src[] = {"Работа","Сон","Еда","Спорт","Чтение","Планирование","Соцсети","Отдых","Дорога","Здоровье","Финансы","Программирование","Электрика","Общение","Йога","Покер","Сбор","Уборка","Философия"};
  nCat = (int)(sizeof src / sizeof src[0]);
  for (int i = 0; i < nCat; i++) snprintf(cats[i], sizeof cats[i], "%s", src[i]);
}
static void ensure_path(void) {
  wchar_t app[MAX_PATH], dir[MAX_PATH];
  SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, app);
  _snwprintf(dir, MAX_PATH, L"%s\\ToDO-AKA", app);
  CreateDirectoryW(dir, NULL);
  _snwprintf(dataPath, MAX_PATH, L"%s\\planner.dat", dir);
}
static void load(void) {
  nCat = nTask = nSpan = 0;
  FILE* f = _wfopen(dataPath, L"rb");
  if (!f) { default_cats(); return; }
  char line[1200];
  int got = 0;
  while (fgets(line, sizeof line, f)) {
    line[strcspn(line, "\r\n")] = 0;
    if (strncmp(line, "CAT\t", 4) == 0 && nCat < MAX_CAT) { snprintf(cats[nCat++], 80, "%s", line + 4); got = 1; }
    else if (strncmp(line, "TASK\t", 5) == 0 && nTask < MAX_TASK) {
      char* p = line + 5; char* fields[7] = {0};
      for (int i = 0; i < 7; i++) { fields[i] = p; char* tab = strchr(p, '\t'); if (!tab) break; *tab = 0; p = tab + 1; }
      Task* t = &tasks[nTask]; memset(t, 0, sizeof *t);
      t->id = atoi(fields[0] ? fields[0] : "0");
      snprintf(t->title, sizeof t->title, "%s", fields[1] ? fields[1] : "");
      t->done = atoi(fields[2] ? fields[2] : "0");
      t->priority = atoi(fields[3] ? fields[3] : "2");
      snprintf(t->deadline, sizeof t->deadline, "%s", fields[4] ? fields[4] : "");
      snprintf(t->created, sizeof t->created, "%s", fields[5] ? fields[5] : "");
      snprintf(t->completed, sizeof t->completed, "%s", fields[6] ? fields[6] : "");
      if (t->id >= nextId) nextId = t->id + 1;
      if (t->title[0]) nTask++;
    } else if (strncmp(line, "SPAN\t", 5) == 0 && nSpan < MAX_SPAN) {
      char* p = line + 5; char* fields[6] = {0};
      for (int i = 0; i < 6; i++) { fields[i] = p; char* tab = strchr(p, '\t'); if (!tab) break; *tab = 0; p = tab + 1; }
      Span* s = &spans[nSpan]; memset(s, 0, sizeof *s);
      s->id = atoi(fields[0] ? fields[0] : "0");
      snprintf(s->day, sizeof s->day, "%s", fields[1] ? fields[1] : "");
      snprintf(s->category, sizeof s->category, "%s", fields[2] ? fields[2] : "");
      s->start = atoll(fields[3] ? fields[3] : "0");
      s->end = atoll(fields[4] ? fields[4] : "0");
      s->score = atoi(fields[5] ? fields[5] : "0");
      if (s->id >= nextId) nextId = s->id + 1;
      if (s->category[0]) nSpan++;
    } else if (strncmp(line, "POMO\t", 5) == 0) sscanf(line + 5, "%d\t%15s", &pomoCount, pomoDay);
  }
  fclose(f);
  if (!got) default_cats();
}
static void save(void) {
  wchar_t tmp[MAX_PATH];
  _snwprintf(tmp, MAX_PATH, L"%s.tmp", dataPath);
  FILE* f = _wfopen(tmp, L"wb");
  if (!f) return;
  fprintf(f, "TODOAKA\t1\n");
  for (int i = 0; i < nCat; i++) fprintf(f, "CAT\t%s\n", cats[i]);
  for (int i = 0; i < nTask; i++) {
    Task* t = &tasks[i];
    fprintf(f, "TASK\t%d\t%s\t%d\t%d\t%s\t%s\t%s\n", t->id, t->title, t->done, t->priority, t->deadline, t->created, t->completed);
  }
  for (int i = 0; i < nSpan; i++) {
    Span* s = &spans[i];
    fprintf(f, "SPAN\t%d\t%s\t%s\t%lld\t%lld\t%d\n", s->id, s->day, s->category, s->start, s->end, s->score);
  }
  fprintf(f, "POMO\t%d\t%s\n", pomoCount, pomoDay);
  fclose(f);
  MoveFileExW(tmp, dataPath, MOVEFILE_REPLACE_EXISTING);
}
static void start_cat(const char* name) {
  char day[16]; today_key(day);
  time_t now = time(NULL);
  Span* open = open_span(day);
  if (open && strcmp(open->category, name) == 0) return;
  if (open) { if ((long long)now <= open->start) return; open->end = (long long)now; }
  if (nSpan >= MAX_SPAN) return;
  Span* s = &spans[nSpan++];
  memset(s, 0, sizeof *s);
  s->id = nextId++;
  snprintf(s->day, sizeof s->day, "%s", day);
  snprintf(s->category, sizeof s->category, "%s", name);
  s->start = (long long)now;
  save();
}
static void stop_open(void) {
  char day[16]; today_key(day);
  Span* open = open_span(day);
  if (!open) return;
  long long now = (long long)time(NULL);
  open->end = now <= open->start ? open->start + 1 : now;
  save();
}
static void set_score(int id, int score) {
  int i = find_span(id);
  if (i < 0 || !spans[i].end) return;
  spans[i].score = score;
  save();
}
static void toggle_task(int id) {
  int i = find_task(id);
  if (i < 0) return;
  undoId = id; undoDone = tasks[i].done; undoAt = GetTickCount();
  tasks[i].done = !tasks[i].done;
  if (tasks[i].done) stamp_now(tasks[i].completed); else tasks[i].completed[0] = 0;
  save();
}
static void undo_task(void) {
  int i = find_task(undoId);
  if (i < 0) return;
  tasks[i].done = undoDone;
  if (!undoDone) tasks[i].completed[0] = 0;
  undoId = 0;
  save();
}
static void delete_task(int id) {
  int i = find_task(id);
  if (i < 0) return;
  memmove(&tasks[i], &tasks[i + 1], (size_t)(nTask - i - 1) * sizeof(Task));
  nTask--;
  save();
}
static void read_date(char* out) {
  SYSTEMTIME st; DateTime_GetSystemtime(gDate, &st);
  sprintf(out, "%04d-%02d-%02d", st.wYear, st.wMonth, st.wDay);
}
static void write_date(const char* s) {
  SYSTEMTIME st; GetLocalTime(&st);
  int y = 0, m = 0, d = 0;
  if (sscanf(s, "%d-%d-%d", &y, &m, &d) == 3 && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
    st.wYear = (WORD)y; st.wMonth = (WORD)m; st.wDay = (WORD)d;
  }
  DateTime_SetSystemtime(gDate, GDT_VALID, &st);
}
static void close_editor(void) {
  editing = 0;
  ShowWindow(gEdit, SW_HIDE);
  ShowWindow(gDate, SW_HIDE);
  if (page == PAGE_CATS) ShowWindow(gEdit, SW_SHOW);
}
static void open_editor(int id) {
  editing = 1; editId = id; page = PAGE_TASKS; pageScroll = 0;
  if (id) {
    int i = find_task(id);
    if (i < 0) return;
    wchar_t w[240]; to_wide(tasks[i].title, w, 240);
    SetWindowTextW(gEdit, w);
    editPrio = tasks[i].priority ? tasks[i].priority : 2;
    snprintf(editCreated, sizeof editCreated, "%s", tasks[i].created);
    write_date(tasks[i].deadline);
  } else {
    SetWindowTextW(gEdit, L"");
    editPrio = 2;
    stamp_now(editCreated);
    write_date("");
  }
  ShowWindow(gEdit, SW_SHOW);
  ShowWindow(gDate, SW_SHOW);
  place_controls();
  SetFocus(gEdit);
}
static void save_editor(void) {
  wchar_t w[240]; GetWindowTextW(gEdit, w, 240);
  char title[240]; to_utf8(w, title, sizeof title); clean(title);
  if (!title[0]) return;
  char deadline[16]; read_date(deadline);
  if (editId) {
    int i = find_task(editId);
    if (i < 0) return;
    snprintf(tasks[i].title, sizeof tasks[i].title, "%s", title);
    tasks[i].priority = editPrio;
    snprintf(tasks[i].deadline, sizeof tasks[i].deadline, "%s", deadline);
  } else if (nTask < MAX_TASK) {
    Task* t = &tasks[nTask++];
    memset(t, 0, sizeof *t);
    t->id = nextId++;
    snprintf(t->title, sizeof t->title, "%s", title);
    t->priority = editPrio;
    snprintf(t->deadline, sizeof t->deadline, "%s", deadline);
    snprintf(t->created, sizeof t->created, "%s", editCreated);
  }
  save();
  close_editor();
}
static void add_cat_from_edit(void) {
  wchar_t w[80]; GetWindowTextW(gEdit, w, 80);
  char name[80]; to_utf8(w, name, sizeof name); clean(name);
  if (!name[0] || nCat >= MAX_CAT) return;
  for (int i = 0; i < nCat; i++) if (strcmp(cats[i], name) == 0) return;
  snprintf(cats[nCat++], 80, "%s", name);
  SetWindowTextW(gEdit, L"");
  save();
}
static void rename_cat(int index) {
  if (index < 0 || index >= nCat) return;
  wchar_t w[80]; GetWindowTextW(gEdit, w, 80);
  char name[80]; to_utf8(w, name, sizeof name); clean(name);
  if (!name[0]) return;
  char old[80]; snprintf(old, sizeof old, "%s", cats[index]);
  snprintf(cats[index], 80, "%s", name);
  for (int i = 0; i < nSpan; i++) if (strcmp(spans[i].category, old) == 0) snprintf(spans[i].category, 80, "%s", name);
  save();
}
static void delete_cat(int index) {
  if (index < 0 || index >= nCat) return;
  memmove(cats[index], cats[index + 1], (size_t)(nCat - index - 1) * sizeof cats[0]);
  nCat--;
  save();
}
static void pomo_start(int minutes) {
  pomoOn = 1; pomoBreak = 0; pomoFull = minutes * 60; pomoLeft = pomoFull; pomoStamp = GetTickCount();
}
static void pomo_tick(void) {
  if (!pomoOn) return;
  DWORD now = GetTickCount();
  int passed = (int)((now - pomoStamp) / 1000);
  if (passed <= 0) return;
  pomoStamp += (DWORD)passed * 1000;
  pomoLeft -= passed;
  if (pomoLeft > 0) return;
  MessageBeep(MB_ICONASTERISK);
  if (!pomoBreak) {
    char day[16]; today_key(day);
    if (strcmp(pomoDay, day) != 0) { snprintf(pomoDay, sizeof pomoDay, "%s", day); pomoCount = 0; }
    pomoCount++;
    pomoBreak = 1; pomoFull = 5 * 60; pomoLeft = pomoFull;
    save();
  } else { pomoOn = 0; pomoLeft = 0; }
}
static void add_hot(RECT r, int kind, int a, int b) {
  if (nHot >= 700) return;
  hots[nHot++] = (Hot){r, kind, a, b};
}
static int hit(int x, int y) {
  POINT p = {x, y};
  for (int i = nHot - 1; i >= 0; i--) if (PtInRect(&hots[i].r, p)) return i;
  return -1;
}
static void round_fill(HDC dc, RECT r, int rad, COLORREF fill, COLORREF border) {
  HBRUSH b = CreateSolidBrush(fill);
  HPEN p = CreatePen(PS_SOLID, 1, border);
  HGDIOBJ ob = SelectObject(dc, b), op = SelectObject(dc, p);
  RoundRect(dc, r.left, r.top, r.right, r.bottom, rad, rad);
  SelectObject(dc, ob); SelectObject(dc, op);
  DeleteObject(b); DeleteObject(p);
}
static void draw_text(HDC dc, const char* s, RECT r, HFONT font, COLORREF col, UINT fmt) {
  wchar_t w[512]; to_wide(s, w, 512);
  SetBkMode(dc, TRANSPARENT); SetTextColor(dc, col); SelectObject(dc, font);
  DrawTextW(dc, w, -1, &r, fmt | DT_NOPREFIX | DT_END_ELLIPSIS);
}
static int text_w(HDC dc, HFONT font, const char* s) {
  wchar_t w[256]; to_wide(s, w, 256);
  SIZE sz; SelectObject(dc, font); GetTextExtentPoint32W(dc, w, lstrlenW(w), &sz); return sz.cx;
}
static RECT btn(HDC dc, int x, int y, const char* label, COLORREF fill, COLORREF fg, int kind, int a) {
  int w = text_w(dc, fontBold, label) + 28;
  RECT r = {x, y, x + w, y + 34};
  round_fill(dc, r, 17, fill, fill);
  draw_text(dc, label, r, fontBold, fg, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
  add_hot(r, kind, a, 0);
  return r;
}
static int chips(HDC dc, int x, int y, int maxX, const char* selected) {
  int cx = x, cy = y;
  for (int i = 0; i < nCat; i++) {
    int w = text_w(dc, fontSmall, cats[i]) + 26;
    if (cx + w > maxX) { cx = x; cy += 40; }
    RECT r = {cx, cy, cx + w, cy + 32};
    int on = selected && strcmp(selected, cats[i]) == 0;
    round_fill(dc, r, 16, on ? COL_GOLD : COL_PANEL2, on ? COL_GOLD : COL_PANEL2);
    draw_text(dc, cats[i], r, fontSmall, on ? COL_INK : COL_CREAM, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    add_hot(r, HOT_CAT, i, 0);
    cx += w + 8;
  }
  return cy + 40;
}
static void pips(HDC dc, int x, int y, int spanId, int value) {
  for (int s = 1; s <= 10; s++) {
    RECT r = {x + (s - 1) * 30, y, x + (s - 1) * 30 + 26, y + 26};
    round_fill(dc, r, 13, value == s ? COL_GOLD : COL_PANEL2, value == s ? COL_GOLD : COL_PANEL2);
    char num[4]; sprintf(num, "%d", s);
    draw_text(dc, num, r, fontSmall, value == s ? COL_INK : COL_MIST, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    add_hot(r, HOT_SCORE, spanId, s);
  }
}
static void note_y(int y) { if (y > contentBottom) contentBottom = y; }
static const char* prio_name(int p) { return p == 1 ? "Важно" : p == 3 ? "Можно" : "Обычно"; }

static void paint_sidebar(HDC dc, int h) {
  RECT bar = {0, 0, SIDE, h};
  HBRUSH b = CreateSolidBrush(COL_PANEL); FillRect(dc, &bar, b); DeleteObject(b);
  RECT brand = {20, 18, SIDE - 12, 62};
  draw_text(dc, "ToDO-AKA", brand, fontTitle, COL_GOLD, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
  const char* names[] = {"Сегодня", "Задачи", "Тайминг", "Рост", "Категории"};
  for (int i = 0; i < 5; i++) {
    RECT r = {12, 84 + i * 48, SIDE - 12, 124 + i * 48};
    if (page == i) round_fill(dc, r, 12, COL_PANEL2, COL_PANEL2);
    RECT label = r; label.left += 16;
    draw_text(dc, names[i], label, page == i ? fontBold : fontUi, page == i ? COL_GOLD : COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    add_hot(r, HOT_NAV, i, 0);
  }
  RECT foot = {16, h - 44, SIDE - 10, h - 14};
  draw_text(dc, "Программа Windows", foot, fontSmall, COL_MIST, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
}
static void paint_today(HDC dc, RECT area) {
  char day[16], pretty[96], clock[32];
  today_key(day);
  int yy, mm, dd; sscanf(day, "%d-%d-%d", &yy, &mm, &dd);
  ru_date(yy, mm, dd, pretty);
  int x = area.left + 28, y = area.top + 18 - pageScroll, maxX = area.right - 28;
  RECT h = {x, y, maxX, y + 20};
  draw_text(dc, "СЕГОДНЯ", h, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
  h.top = y + 22; h.bottom = y + 62;
  draw_text(dc, pretty, h, fontTitle, COL_CREAM, DT_LEFT | DT_SINGLELINE);
  y += 74;
  Span* open = open_span(day);
  RECT card = {x, y, maxX, y + 86};
  round_fill(dc, card, 16, COL_PANEL, COL_LINE);
  if (open) {
    RECT t = {x + 18, y + 10, maxX - 140, y + 30};
    draw_text(dc, "СЕЙЧАС", t, fontSmall, COL_GOLD, DT_LEFT | DT_SINGLELINE);
    t.top = y + 28; t.bottom = y + 60;
    draw_text(dc, open->category, t, fontTitle, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    fmt_span(span_seconds(open), clock);
    t.top = y + 58; t.bottom = y + 80;
    draw_text(dc, clock, t, fontUi, COL_MIST, DT_LEFT | DT_SINGLELINE);
    btn(dc, maxX - 110, y + 26, "Стоп", COL_EMBER, COL_INK, HOT_STOP, 0);
  } else {
    RECT t = {x + 18, y + 26, maxX - 18, y + 60};
    draw_text(dc, "Выбери, чем занят. Следующая категория закроет эту.", t, fontUi, COL_MIST, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
  }
  y = chips(dc, x, card.bottom + 14, maxX, open ? open->category : NULL) + 8;
  int shown = 0;
  for (int i = nSpan - 1; i >= 0 && shown < 6; i--) {
    if (!spans[i].end || spans[i].score || strcmp(spans[i].day, day) != 0) continue;
    RECT row = {x, y, maxX, y + 64};
    round_fill(dc, row, 14, COL_PANEL, COL_LINE);
    char cap[140]; snprintf(cap, sizeof cap, "Как прошёл этап · %s", spans[i].category);
    RECT t = {x + 14, y + 6, maxX - 14, y + 26};
    draw_text(dc, cap, t, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
    pips(dc, x + 14, y + 30, spans[i].id, spans[i].score);
    y += 72; shown++;
  }
  int rated = 0; double score = day_score(day, &rated);
  char line[96];
  if (rated) snprintf(line, sizeof line, "Оценка дня  %.1f   из %d этапов", score, rated);
  else snprintf(line, sizeof line, "Оценка дня  —   оцени закрытые этапы");
  RECT sc = {x, y, maxX, y + 28};
  draw_text(dc, line, sc, fontUi, COL_CREAM, DT_LEFT | DT_SINGLELINE);
  y += 38;
  RECT pomo = {x, y, maxX, y + 108};
  round_fill(dc, pomo, 16, COL_PANEL, COL_GOLD);
  RECT t = {x + 18, y + 12, maxX - 20, y + 32};
  draw_text(dc, "ПОМИДОР", t, fontSmall, COL_GOLD, DT_LEFT | DT_SINGLELINE);
  t.top = y + 32; t.bottom = y + 64;
  if (pomoOn) {
    fmt_span(pomoLeft, clock);
    char cap[64]; snprintf(cap, sizeof cap, "%s  %s", pomoBreak ? "Отдых" : "Фокус", clock);
    draw_text(dc, cap, t, fontTitle, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    btn(dc, maxX - 120, y + 36, "Стоп", COL_PANEL2, COL_CREAM, HOT_PSTOP, 0);
  } else {
    draw_text(dc, "25 или 50 минут одного дела", t, fontBold, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    RECT a = btn(dc, x + 18, y + 64, "Старт 25", COL_GOLD, COL_INK, HOT_P25, 0);
    btn(dc, a.right + 8, y + 64, "Старт 50", COL_PANEL2, COL_CREAM, HOT_P50, 0);
  }
  note_y(pomo.bottom + 24 + pageScroll);
}
static void paint_tasks(HDC dc, RECT area) {
  int x = area.left + 28, y = area.top + 18 - pageScroll, maxX = area.right - 28;
  RECT h = {x, y, maxX - 190, y + 42};
  draw_text(dc, "Задачи", h, fontTitle, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
  btn(dc, maxX - 180, y + 4, "Новая задача", COL_GOLD, COL_INK, HOT_NEW, 0);
  y += 56;
  if (editing) {
    RECT card = {x, y, maxX, y + 168};
    round_fill(dc, card, 16, COL_PANEL, COL_LINE);
    RECT t = {x + 16, y + 8, x + 220, y + 28};
    draw_text(dc, "Текст", t, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
    t.top = y + 64; t.bottom = y + 84;
    draw_text(dc, "Важность", t, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
    RECT a = btn(dc, x + 16, y + 90, "Важно", editPrio == 1 ? COL_EMBER : COL_PANEL2, editPrio == 1 ? COL_INK : COL_CREAM, HOT_PRIO, 1);
    a = btn(dc, a.right + 8, y + 90, "Обычно", editPrio == 2 ? COL_GOLD : COL_PANEL2, editPrio == 2 ? COL_INK : COL_CREAM, HOT_PRIO, 2);
    btn(dc, a.right + 8, y + 90, "Можно", editPrio == 3 ? COL_CREAM : COL_PANEL2, editPrio == 3 ? COL_INK : COL_CREAM, HOT_PRIO, 3);
    t.left = x + 360; t.top = y + 8; t.right = x + 560; t.bottom = y + 28;
    draw_text(dc, "Дедлайн", t, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
    char created[96]; snprintf(created, sizeof created, "Поставлено  %s", editCreated);
    t.top = y + 64; t.bottom = y + 86;
    draw_text(dc, created, t, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
    a = btn(dc, maxX - 300, y + 122, "Сохранить", COL_GOLD, COL_INK, HOT_SAVE, 0);
    a = btn(dc, a.right + 8, y + 122, "Отмена", COL_PANEL2, COL_CREAM, HOT_CANCEL, 0);
    if (editId) btn(dc, a.right + 8, y + 122, "Удалить", COL_EMBER, COL_INK, HOT_DEL, editId);
    y += 180;
  }
  for (int i = 0; i < nTask; i++) {
    Task* task = &tasks[i];
    RECT row = {x, y, maxX, y + 64};
    round_fill(dc, row, 14, COL_PANEL, COL_LINE);
    RECT box = {x + 16, y + 18, x + 40, y + 42};
    round_fill(dc, box, 12, task->done ? COL_GOLD : COL_BG, task->done ? COL_GOLD : COL_MIST);
    add_hot(box, HOT_TOGGLE, task->id, 0);
    RECT title = {x + 52, y + 8, maxX - 160, y + 34};
    draw_text(dc, task->title, title, fontBold, task->done ? COL_MIST : COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    char meta[180];
    snprintf(meta, sizeof meta, "%s   до %s   с %s", prio_name(task->priority), task->deadline[0] ? task->deadline : "—", task->created);
    title.top = y + 34; title.bottom = y + 56;
    draw_text(dc, meta, title, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
    btn(dc, maxX - 140, y + 15, "Изменить", COL_PANEL2, COL_CREAM, HOT_EDIT, task->id);
    y += 72;
  }
  if (!nTask) {
    RECT t = {x, y, maxX, y + 28};
    draw_text(dc, "Пока пусто. Добавь первое дело.", t, fontUi, COL_MIST, DT_LEFT | DT_SINGLELINE);
    y += 28;
  }
  note_y(y + 24 + pageScroll);
}
static void paint_time(HDC dc, RECT area) {
  char key[16], pretty[96], clock[32];
  view_key(key); ru_date(viewY, viewM, viewD, pretty);
  int x = area.left + 28, y = area.top + 18 - pageScroll, maxX = area.right - 28;
  RECT h = {x, y, maxX - 330, y + 42};
  draw_text(dc, pretty, h, fontTitle, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
  RECT a = btn(dc, maxX - 310, y + 6, "Назад", COL_PANEL2, COL_CREAM, HOT_PREV, 0);
  a = btn(dc, a.right + 8, y + 6, "Сегодня", COL_PANEL2, COL_CREAM, HOT_TODAY, 0);
  btn(dc, a.right + 8, y + 6, "Вперёд", COL_PANEL2, COL_CREAM, HOT_NEXT, 0);
  y += 58;
  int any = 0; long long grand = 0;
  for (int i = 0; i < nSpan; i++) {
    if (strcmp(spans[i].day, key) != 0) continue;
    any = 1; grand += span_seconds(&spans[i]);
    RECT row = {x, y, maxX, y + (spans[i].end ? 78 : 52)};
    round_fill(dc, row, 14, COL_PANEL, COL_LINE);
    time_t stt = (time_t)spans[i].start;
    struct tm st = *localtime(&stt);
    char when[64];
    if (spans[i].end) {
      time_t ent = (time_t)spans[i].end;
      struct tm en = *localtime(&ent);
      sprintf(when, "%02d:%02d – %02d:%02d", st.tm_hour, st.tm_min, en.tm_hour, en.tm_min);
    } else sprintf(when, "%02d:%02d – идёт", st.tm_hour, st.tm_min);
    fmt_span(span_seconds(&spans[i]), clock);
    char line[180]; snprintf(line, sizeof line, "%s    %s    %s", when, spans[i].category, clock);
    RECT t = {x + 14, y + 8, maxX - 120, y + 32};
    draw_text(dc, line, t, fontUi, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    if (spans[i].end) {
      pips(dc, x + 14, y + 40, spans[i].id, spans[i].score);
      btn(dc, maxX - 112, y + 8, "Убрать", COL_PANEL2, COL_EMBER, HOT_DEL_SPAN, spans[i].id);
    }
    y += spans[i].end ? 86 : 60;
  }
  if (!any) {
    RECT t = {x, y, maxX, y + 26};
    draw_text(dc, "За этот день ещё пусто.", t, fontUi, COL_MIST, DT_LEFT | DT_SINGLELINE);
    y += 34;
  }
  fmt_hm(grand, clock);
  int rated = 0; double score = day_score(key, &rated);
  char total[140];
  if (rated) snprintf(total, sizeof total, "Всего %s    оценка дня %.1f", clock, score);
  else snprintf(total, sizeof total, "Всего %s    оценка появится после этапов", clock);
  RECT t = {x, y, maxX, y + 28};
  draw_text(dc, total, t, fontBold, COL_GOLD, DT_LEFT | DT_SINGLELINE);
  note_y(y + 36 + pageScroll);
}
static void paint_stats(HDC dc, RECT area) {
  char day[16]; today_key(day);
  int x = area.left + 28, y = area.top + 18 - pageScroll, maxX = area.right - 28;
  RECT h = {x, y, maxX, y + 42};
  draw_text(dc, "Рост", h, fontTitle, COL_CREAM, DT_LEFT | DT_SINGLELINE);
  y += 52;
  int rated = 0; double score = day_score(day, &rated);
  char line[80];
  snprintf(line, sizeof line, rated ? "Сегодня  %.1f из 10" : "Сегодня ещё без оценки", score);
  RECT card = {x, y, x + 300, y + 78};
  round_fill(dc, card, 16, COL_PANEL, COL_LINE);
  RECT t = {x + 16, y + 16, x + 284, y + 62};
  draw_text(dc, line, t, fontBold, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
  char pomos[40]; snprintf(pomos, sizeof pomos, "Помидоры  %d", pomoCount);
  card.left = x + 316; card.right = x + 560;
  round_fill(dc, card, 16, COL_PANEL, COL_LINE);
  t.left = x + 332; t.right = x + 544;
  draw_text(dc, pomos, t, fontBold, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
  y += 98;
  h.top = y; h.bottom = y + 28;
  draw_text(dc, "Время по категориям", h, fontBold, COL_CREAM, DT_LEFT | DT_SINGLELINE);
  y += 36;
  long long totals[MAX_CAT]; memset(totals, 0, sizeof totals);
  long long maxv = 1;
  for (int i = 0; i < nSpan; i++) if (strcmp(spans[i].day, day) == 0) {
    for (int c = 0; c < nCat; c++) if (strcmp(spans[i].category, cats[c]) == 0) {
      totals[c] += span_seconds(&spans[i]);
      if (totals[c] > maxv) maxv = totals[c];
    }
  }
  int shown = 0;
  for (int c = 0; c < nCat; c++) {
    if (!totals[c]) continue;
    shown++;
    char clock[32]; fmt_hm(totals[c], clock);
    RECT name = {x, y, x + 200, y + 20};
    draw_text(dc, cats[c], name, fontSmall, COL_CREAM, DT_LEFT | DT_SINGLELINE);
    RECT val = {maxX - 130, y, maxX, y + 20};
    draw_text(dc, clock, val, fontSmall, COL_GOLD, DT_RIGHT | DT_SINGLELINE);
    RECT bar = {x, y + 22, maxX, y + 30};
    round_fill(dc, bar, 6, COL_PANEL2, COL_PANEL2);
    int w = (int)((maxX - x) * totals[c] / maxv); if (w < 8) w = 8;
    RECT fill = {x, y + 22, x + w, y + 30};
    round_fill(dc, fill, 6, COL_GOLD, COL_GOLD);
    y += 42;
  }
  if (!shown) {
    RECT empty = {x, y, maxX, y + 24};
    draw_text(dc, "Тайминг за сегодня ещё не начат.", empty, fontUi, COL_MIST, DT_LEFT | DT_SINGLELINE);
    y += 24;
  }
  note_y(y + 20 + pageScroll);
}
static void paint_cats(HDC dc, RECT area) {
  int x = area.left + 28, y = area.top + 18 - pageScroll, maxX = area.right - 28;
  RECT h = {x, y, maxX, y + 42};
  draw_text(dc, "Категории", h, fontTitle, COL_CREAM, DT_LEFT | DT_SINGLELINE);
  y += 48;
  RECT hint = {x, y, maxX, y + 22};
  draw_text(dc, "Напиши имя в поле справа и добавь или переименуй.", hint, fontSmall, COL_MIST, DT_LEFT | DT_SINGLELINE);
  y += 34;
  btn(dc, x, y, "Добавить", COL_GOLD, COL_INK, HOT_ADD_CAT, 0);
  y += 48;
  for (int i = 0; i < nCat; i++) {
    RECT row = {x, y, maxX, y + 48};
    round_fill(dc, row, 12, COL_PANEL, COL_LINE);
    RECT t = {x + 14, y, x + 300, y + 48};
    draw_text(dc, cats[i], t, fontUi, COL_CREAM, DT_LEFT | DT_VCENTER | DT_SINGLELINE);
    RECT a = btn(dc, maxX - 300, y + 7, "Переименовать", COL_PANEL2, COL_CREAM, HOT_REN_CAT, i);
    btn(dc, a.right + 8, y + 7, "Удалить", COL_PANEL2, COL_EMBER, HOT_DEL_CAT, i);
    y += 56;
  }
  note_y(y + 20 + pageScroll);
}
static void place_controls(void) {
  if (!gWnd) return;
  int showEdit = (editing && page == PAGE_TASKS) || page == PAGE_CATS;
  if (!showEdit) { ShowWindow(gEdit, SW_HIDE); ShowWindow(gDate, SW_HIDE); return; }
  int x = SIDE + 28, y = 18 - pageScroll;
  if (page == PAGE_TASKS) {
    SetWindowPos(gEdit, HWND_TOP, x + 16, y + 56 + 30, 320, 26, SWP_SHOWWINDOW);
    SetWindowPos(gDate, HWND_TOP, x + 360, y + 56 + 30, 190, 26, SWP_SHOWWINDOW);
  } else {
    SetWindowPos(gEdit, HWND_TOP, x + 150, y + 82, 280, 26, SWP_SHOWWINDOW);
    ShowWindow(gDate, SW_HIDE);
  }
}
static void paint_all(HWND hwnd) {
  PAINTSTRUCT ps; HDC wnd = BeginPaint(hwnd, &ps);
  RECT cr; GetClientRect(hwnd, &cr);
  HDC dc = CreateCompatibleDC(wnd);
  HBITMAP bmp = CreateCompatibleBitmap(wnd, cr.right, cr.bottom);
  HGDIOBJ old = SelectObject(dc, bmp);
  HBRUSH bg = CreateSolidBrush(COL_BG); FillRect(dc, &cr, bg); DeleteObject(bg);
  nHot = 0; contentBottom = 0;
  RECT area = {SIDE, 0, cr.right, cr.bottom};
  IntersectClipRect(dc, area.left, area.top, area.right, area.bottom);
  if (page == PAGE_TODAY) paint_today(dc, area);
  else if (page == PAGE_TASKS) paint_tasks(dc, area);
  else if (page == PAGE_TIME) paint_time(dc, area);
  else if (page == PAGE_STATS) paint_stats(dc, area);
  else paint_cats(dc, area);
  SelectClipRgn(dc, NULL);
  if (undoId && GetTickCount() - undoAt < 6000) {
    RECT b = {SIDE + 28, cr.bottom - 58, SIDE + 420, cr.bottom - 16};
    round_fill(dc, b, 14, COL_PANEL2, COL_GOLD);
    draw_text(dc, "Готово. Нажми, чтобы отменить", b, fontUi, COL_CREAM, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    add_hot(b, HOT_UNDO, 0, 0);
  }
  paint_sidebar(dc, cr.bottom);
  pageMax = contentBottom - cr.bottom; if (pageMax < 0) pageMax = 0;
  if (pageScroll > pageMax) pageScroll = pageMax;
  BitBlt(wnd, 0, 0, cr.right, cr.bottom, dc, 0, 0, SRCCOPY);
  SelectObject(dc, old); DeleteObject(bmp); DeleteDC(dc);
  EndPaint(hwnd, &ps);
}
static void go(int next) {
  if (page != next) close_editor();
  page = next; pageScroll = 0;
  if (page == PAGE_CATS) { ShowWindow(gEdit, SW_SHOW); SetWindowTextW(gEdit, L""); }
  place_controls();
  InvalidateRect(gWnd, NULL, FALSE);
}
static void on_hot(const Hot* h) {
  switch (h->kind) {
    case HOT_NAV: go(h->a); break;
    case HOT_CAT: if (h->a >= 0 && h->a < nCat) start_cat(cats[h->a]); break;
    case HOT_STOP: stop_open(); break;
    case HOT_SCORE: set_score(h->a, h->b); break;
    case HOT_NEW: open_editor(0); break;
    case HOT_TOGGLE: toggle_task(h->a); break;
    case HOT_EDIT: open_editor(h->a); break;
    case HOT_SAVE: save_editor(); break;
    case HOT_CANCEL: close_editor(); break;
    case HOT_DEL: delete_task(h->a); close_editor(); break;
    case HOT_PRIO: editPrio = h->a; break;
    case HOT_P25: pomo_start(25); break;
    case HOT_P50: pomo_start(50); break;
    case HOT_PSTOP: pomoOn = 0; break;
    case HOT_PREV: shift_view(-1); break;
    case HOT_NEXT: shift_view(1); break;
    case HOT_TODAY: set_view_today(); break;
    case HOT_ADD_CAT: add_cat_from_edit(); break;
    case HOT_REN_CAT: rename_cat(h->a); break;
    case HOT_DEL_CAT: delete_cat(h->a); break;
    case HOT_UNDO: undo_task(); break;
    case HOT_DEL_SPAN: {
      int i = find_span(h->a);
      if (i >= 0) { memmove(&spans[i], &spans[i + 1], (size_t)(nSpan - i - 1) * sizeof(Span)); nSpan--; save(); }
      break;
    }
    default: break;
  }
  InvalidateRect(gWnd, NULL, FALSE);
}
static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  switch (msg) {
    case WM_CREATE:
      gEdit = CreateWindowExW(0, L"EDIT", L"", WS_CHILD | ES_AUTOHSCROLL, 0, 0, 10, 10, hwnd, (HMENU)101, gInst, NULL);
      gDate = CreateWindowExW(0, DATETIMEPICK_CLASSW, L"", WS_CHILD | DTS_SHORTDATEFORMAT, 0, 0, 10, 10, hwnd, (HMENU)102, gInst, NULL);
      SendMessageW(gEdit, WM_SETFONT, (WPARAM)fontUi, TRUE);
      SendMessageW(gDate, WM_SETFONT, (WPARAM)fontUi, TRUE);
      SendMessageW(gEdit, EM_SETCUEBANNER, TRUE, (LPARAM)L"Что сделать");
      SetTimer(hwnd, 1, 1000, NULL);
      return 0;
    case WM_COMMAND:
      if (LOWORD(wp) == 1) DestroyWindow(hwnd);
      if (LOWORD(wp) == 2) {
        wchar_t text[460];
        _snwprintf(text, 460, L"ToDO-AKA\nЗадачи, тайминг, помидор и оценка дня.\n\nДанные:\n%s", dataPath);
        MessageBoxW(hwnd, text, L"О программе", MB_OK);
      }
      return 0;
    case WM_TIMER:
      pomo_tick();
      if (undoId && GetTickCount() - undoAt >= 6000) undoId = 0;
      InvalidateRect(hwnd, NULL, FALSE);
      return 0;
    case WM_MOUSEMOVE: {
      int i = hit((int)(short)LOWORD(lp), (int)(short)HIWORD(lp));
      if (i != hover) { hover = i; SetCursor(LoadCursor(NULL, i >= 0 ? IDC_HAND : IDC_ARROW)); }
      return 0;
    }
    case WM_SETCURSOR:
      if (hover >= 0) { SetCursor(LoadCursor(NULL, IDC_HAND)); return TRUE; }
      break;
    case WM_LBUTTONUP: {
      int i = hit((int)(short)LOWORD(lp), (int)(short)HIWORD(lp));
      if (i >= 0) on_hot(&hots[i]);
      return 0;
    }
    case WM_MOUSEWHEEL: {
      pageScroll -= GET_WHEEL_DELTA_WPARAM(wp) / 2;
      if (pageScroll < 0) pageScroll = 0;
      if (pageScroll > pageMax) pageScroll = pageMax;
      place_controls();
      InvalidateRect(hwnd, NULL, FALSE);
      return 0;
    }
    case WM_KEYDOWN:
      if (wp == VK_ESCAPE) { close_editor(); InvalidateRect(hwnd, NULL, FALSE); }
      return 0;
    case WM_CTLCOLOREDIT: {
      SetTextColor((HDC)wp, COL_CREAM);
      SetBkColor((HDC)wp, RGB(36, 34, 30));
      return (LRESULT)brushEdit;
    }
    case WM_ERASEBKGND: return 1;
    case WM_PAINT: paint_all(hwnd); return 0;
    case WM_SIZE: place_controls(); InvalidateRect(hwnd, NULL, FALSE); return 0;
    case WM_GETMINMAXINFO: {
      MINMAXINFO* m = (MINMAXINFO*)lp;
      m->ptMinTrackSize.x = 980; m->ptMinTrackSize.y = 640;
      return 0;
    }
    case WM_DESTROY: save(); PostQuitMessage(0); return 0;
    default: break;
  }
  return DefWindowProcW(hwnd, msg, wp, lp);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, PWSTR cmd, int show) {
  (void)prev; (void)cmd; gInst = inst;
  HMODULE user = GetModuleHandleW(L"user32.dll");
  BOOL (WINAPI *setDpi)(HANDLE) = (BOOL (WINAPI *)(HANDLE))GetProcAddress(user, "SetProcessDpiAwarenessContext");
  if (setDpi) setDpi((HANDLE)(LONG_PTR)-4);
  INITCOMMONCONTROLSEX icc = {sizeof icc, ICC_DATE_CLASSES};
  InitCommonControlsEx(&icc);
  ensure_path(); load(); set_view_today(); today_key(pomoDay);
  fontUi = CreateFontW(-16, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
  fontBold = CreateFontW(-16, 0, 0, 0, FW_SEMIBOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
  fontSmall = CreateFontW(-13, 0, 0, 0, FW_NORMAL, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
  fontTitle = CreateFontW(-28, 0, 0, 0, FW_SEMIBOLD, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, L"Segoe UI");
  brushEdit = CreateSolidBrush(RGB(36, 34, 30));
  WNDCLASSW wc = {0};
  wc.lpfnWndProc = WndProc; wc.hInstance = inst; wc.lpszClassName = L"ToDOAKA";
  wc.hCursor = LoadCursor(NULL, IDC_ARROW);
  RegisterClassW(&wc);
  gWnd = CreateWindowExW(0, L"ToDOAKA", L"ToDO-AKA", WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN, CW_USEDEFAULT, CW_USEDEFAULT, 1180, 760, NULL, NULL, inst, NULL);
  HMODULE dwm = LoadLibraryW(L"dwmapi.dll");
  if (dwm) {
    HRESULT (WINAPI *setAttr)(HWND, DWORD, LPCVOID, DWORD) = (HRESULT (WINAPI *)(HWND, DWORD, LPCVOID, DWORD))GetProcAddress(dwm, "DwmSetWindowAttribute");
    if (setAttr) { int dark = 1; setAttr(gWnd, 20, &dark, sizeof dark); }
  }
  HMENU bar = CreateMenu(), file = CreateMenu(), help = CreateMenu();
  AppendMenuW(file, MF_STRING, 1, L"Выход");
  AppendMenuW(bar, MF_POPUP, (UINT_PTR)file, L"Файл");
  AppendMenuW(help, MF_STRING, 2, L"О программе");
  AppendMenuW(bar, MF_POPUP, (UINT_PTR)help, L"Справка");
  SetMenu(gWnd, bar);
  ShowWindow(gWnd, show);
  MSG msg;
  while (GetMessageW(&msg, NULL, 0, 0)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
  return 0;
}
