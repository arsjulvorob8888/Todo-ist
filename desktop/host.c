/* Opens the same ToDO-AKA interface as the site, in its own window. */
#define WIN32_LEAN_AND_MEAN
#define UNICODE
#define _UNICODE
#include <winsock2.h>
#include <windows.h>
#include <shlobj.h>
#include <stdio.h>
#include <stdlib.h>

static int port_open(int port) {
  SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (s == INVALID_SOCKET) return 0;
  struct sockaddr_in addr;
  memset(&addr, 0, sizeof addr);
  addr.sin_family = AF_INET;
  addr.sin_port = htons((u_short)port);
  addr.sin_addr.s_addr = htonl(0x7f000001);
  int ok = connect(s, (struct sockaddr*)&addr, sizeof addr) == 0;
  closesocket(s);
  return ok;
}

static int file_exists(const wchar_t* path) {
  DWORD a = GetFileAttributesW(path);
  return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY);
}

static wchar_t* find_browser(wchar_t* out, int cap) {
  const wchar_t* rel[] = {
      L"\\Microsoft\\Edge\\Application\\msedge.exe",
      L"\\Google\\Chrome\\Application\\chrome.exe",
      L"\\Yandex\\YandexBrowser\\Application\\browser.exe",
  };
  wchar_t roots[4][MAX_PATH];
  GetEnvironmentVariableW(L"ProgramFiles", roots[0], MAX_PATH);
  GetEnvironmentVariableW(L"ProgramFiles(x86)", roots[1], MAX_PATH);
  GetEnvironmentVariableW(L"LocalAppData", roots[2], MAX_PATH);
  roots[3][0] = 0;
  for (int r = 0; r < 3; r++) {
    if (!roots[r][0]) continue;
    for (int i = 0; i < 3; i++) {
      _snwprintf(out, cap, L"%s%s", roots[r], rel[i]);
      if (file_exists(out)) return out;
    }
  }
  return NULL;
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, PWSTR cmd, int show) {
  (void)inst; (void)prev; (void)cmd; (void)show;
  wchar_t exe[MAX_PATH];
  GetModuleFileNameW(NULL, exe, MAX_PATH);
  wchar_t* slash = wcsrchr(exe, L'\\');
  if (slash) *slash = 0;

  wchar_t node[MAX_PATH], server[MAX_PATH], profile[MAX_PATH];
  _snwprintf(node, MAX_PATH, L"%s\\node.exe", exe);
  _snwprintf(server, MAX_PATH, L"%s\\.output\\server\\index.mjs", exe);
  wchar_t appdata[MAX_PATH], dir[MAX_PATH];
  SHGetFolderPathW(NULL, CSIDL_APPDATA, NULL, 0, appdata);
  _snwprintf(dir, MAX_PATH, L"%s\\ToDO-AKA", appdata);
  CreateDirectoryW(dir, NULL);
  _snwprintf(profile, MAX_PATH, L"%s\\window", dir);
  CreateDirectoryW(profile, NULL);

  if (!file_exists(node) || !file_exists(server)) {
    MessageBoxW(NULL, L"Рядом с ToDO-AKA.exe нет node.exe или папки программы. Распакуй весь архив.", L"ToDO-AKA", MB_ICONERROR);
    return 1;
  }
  wchar_t browser[MAX_PATH];
  if (!find_browser(browser, MAX_PATH)) {
    MessageBoxW(NULL, L"Нужен Microsoft Edge, Chrome или Яндекс Браузер.", L"ToDO-AKA", MB_ICONERROR);
    return 1;
  }

  WSADATA wsa;
  WSAStartup(MAKEWORD(2, 2), &wsa);
  int port = 47621;
  for (int i = 0; i < 20; i++)
    if (!port_open(47621 + i)) { port = 47621 + i; break; }

  wchar_t* env = (wchar_t*)calloc(65536, sizeof(wchar_t));
  int n = 0;
  wchar_t* block = GetEnvironmentStringsW();
  if (block) {
    for (wchar_t* p = block; *p; ) {
      int len = lstrlenW(p) + 1;
      if (n + len < 64000 && wcsncmp(p, L"PORT=", 5) && wcsncmp(p, L"HOST=", 5)) {
        memcpy(env + n, p, (size_t)len * sizeof(wchar_t));
        n += len;
      }
      p += len;
    }
    FreeEnvironmentStringsW(block);
  }
  n += _snwprintf(env + n, 100, L"PORT=%d", port) + 1;
  n += _snwprintf(env + n, 100, L"HOST=127.0.0.1") + 1;
  env[n] = 0;

  wchar_t cmdline[1200];
  _snwprintf(cmdline, 1200, L"\"%s\" \"%s\"", node, server);
  STARTUPINFOW si = {sizeof si};
  si.dwFlags = STARTF_USESHOWWINDOW;
  si.wShowWindow = SW_HIDE;
  PROCESS_INFORMATION pi = {0};
  if (!CreateProcessW(node, cmdline, NULL, NULL, FALSE, CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT, env, exe, &si, &pi)) {
    MessageBoxW(NULL, L"Не удалось запустить программу.", L"ToDO-AKA", MB_ICONERROR);
    return 1;
  }

  int up = 0;
  for (int i = 0; i < 80; i++) {
    if (port_open(port)) { up = 1; break; }
    DWORD code = 0;
    if (GetExitCodeProcess(pi.hProcess, &code) && code != STILL_ACTIVE) break;
    Sleep(250);
  }
  if (!up) {
    TerminateProcess(pi.hProcess, 1);
    MessageBoxW(NULL, L"Окно не открылось: локальный сервер не ответил.", L"ToDO-AKA", MB_ICONERROR);
    return 1;
  }

  wchar_t url[256];
  _snwprintf(url, 256, L"http://127.0.0.1:%d/", port);
  wchar_t bcmd[1600];
  _snwprintf(bcmd, 1600, L"\"%s\" --app=%s --user-data-dir=\"%s\" --no-first-run --disable-extensions --window-size=1280,860", browser, url, profile);
  STARTUPINFOW bsi = {sizeof bsi};
  PROCESS_INFORMATION bpi = {0};
  if (!CreateProcessW(browser, bcmd, NULL, NULL, FALSE, 0, NULL, NULL, &bsi, &bpi)) {
    TerminateProcess(pi.hProcess, 1);
    MessageBoxW(NULL, L"Не удалось открыть окно.", L"ToDO-AKA", MB_ICONERROR);
    return 1;
  }
  WaitForSingleObject(bpi.hProcess, INFINITE);
  TerminateProcess(pi.hProcess, 0);
  WaitForSingleObject(pi.hProcess, 3000);
  CloseHandle(bpi.hProcess); CloseHandle(bpi.hThread);
  CloseHandle(pi.hProcess); CloseHandle(pi.hThread);
  WSACleanup();
  return 0;
}
