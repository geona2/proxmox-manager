import React, { useState, useEffect } from "react";

interface UserItem {
  username: string;
  role: string;
}

interface UsersTabProps {
  backendUrl: string;
  authToken: string;
  currentUser: string;
}

export default function UsersTab({ backendUrl, authToken, currentUser }: UsersTabProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "operator" | "reader">("reader");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/auth/users`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error("사용자 목록을 불러오지 못했습니다.");
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [authToken]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/auth/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "계정 생성에 실패했습니다.");
      }
      setNewUsername("");
      setNewPassword("");
      setNewRole("reader");
      fetchUsers();
      alert("사용자 계정이 생성되었습니다.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser) {
      alert("자기 자신은 삭제할 수 없습니다.");
      return;
    }
    if (!confirm(`정말 ${username} 계정을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`${backendUrl}/api/auth/users/${username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error("계정 삭제에 실패했습니다.");
      fetchUsers();
      alert("계정이 삭제되었습니다.");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-white">사용자 권한 관리 (RBAC User Manager)</h2>
        <p className="text-xs text-slate-300">대시보드에 접근할 사용자를 관리하고 역할별(Admin, Operator, Reader) 권한을 지정합니다.</p>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Creation Form */}
        <div className="glass-card rounded-2xl p-6 border border-indigo-500/10 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-white">새 사용자 추가</h3>
          <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">사용자 ID</label>
              <input
                type="text"
                required
                placeholder="아이디 입력"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">비밀번호</label>
              <input
                type="password"
                required
                placeholder="비밀번호 설정"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">역할 권한 (Role)</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full bg-slate-900 border border-indigo-500/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="reader">Reader (조회 전용)</option>
                <option value="operator">Operator (제어 및 생성 가능)</option>
                <option value="admin">Admin (모든 권한)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !newUsername || !newPassword}
              className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition disabled:opacity-30 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? "계정 생성 중..." : "사용자 생성"}
            </button>
          </form>
        </div>

        {/* User List Table */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-white">등록된 사용자 리스트</h3>
          
          <div className="border border-indigo-500/5 rounded-xl overflow-hidden bg-slate-950/20">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-indigo-500/10 text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">사용자명</th>
                  <th className="px-5 py-3">부여된 역할</th>
                  <th className="px-5 py-3 text-right">관리 작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.username} className="hover:bg-slate-900/40 border-b border-indigo-500/5 transition">
                    <td className="px-5 py-3.5 text-sm font-semibold text-white">
                      {user.username} {user.username === currentUser && <span className="text-xs font-normal text-indigo-400 font-semibold">(본인)</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        user.role === "admin"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/10"
                          : user.role === "operator"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                            : "bg-slate-800 text-slate-300 border border-slate-700/50"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.username)}
                        disabled={user.username === currentUser}
                        className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition disabled:opacity-20"
                      >
                        계정 삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
