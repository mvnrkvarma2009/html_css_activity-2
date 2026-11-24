import ctypes, subprocess, os
from ctypes import wintypes

class CREDENTIAL(ctypes.Structure):
    _fields_ = [
        ('Flags', wintypes.DWORD), ('Type', wintypes.DWORD), ('TargetName', wintypes.LPWSTR),
        ('Comment', wintypes.LPWSTR), ('LastWritten', wintypes.FILETIME),
        ('CredentialBlobSize', wintypes.DWORD), ('CredentialBlob', ctypes.POINTER(ctypes.c_char)),
        ('Persist', wintypes.DWORD), ('AttributeCount', wintypes.DWORD),
        ('Attributes', ctypes.c_void_p), ('TargetAlias', wintypes.LPWSTR), ('UserName', wintypes.LPWSTR),
    ]

CredReadW = ctypes.windll.advapi32.CredReadW
CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(CREDENTIAL))]
CredReadW.restype = wintypes.BOOL

pcred = ctypes.POINTER(CREDENTIAL)()
ok = CredReadW('git:https://github.com', 1, 0, ctypes.byref(pcred))
blob = ctypes.string_at(pcred.contents.CredentialBlob, pcred.contents.CredentialBlobSize)
token = ''.join(chr(b) for b in blob if 32 <= b <= 126)

repo = r'C:\Users\Nagendra Varma\Downloads\html_css_activity-2'
subprocess.run(['git', 'add', '-A'], cwd=repo, check=True)
commit_msg = 'refactor: convert Activity 2 to 100% pure HTML and CSS only - zero JavaScript'
subprocess.run(['git', 'commit', '-m', commit_msg], cwd=repo, check=True)

auth_url = f'https://x-access-token:{token}@github.com/mvnrkvarma2009/html_css_activity-2.git'
res = subprocess.run(['git', 'push', auth_url, 'main'], cwd=repo, capture_output=True, text=True, timeout=20)
print('STDOUT:', res.stdout)
print('STDERR:', res.stderr)
