import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Plus, Edit2, Users } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  code: string;
  description: string;
  system_role: boolean;
  status: string;
}

export default function RoleManagement() {
  const { session } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/roles', {
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRoles(data);
        }
      } catch (error) {
        console.error('Failed to fetch roles', error);
      } finally {
        setLoading(false);
      }
    };
    if (session) fetchRoles();
  }, [session]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-foreground font-sans">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-foreground" />
            Role Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage organization roles and system access.</p>
        </div>
        <button className="bg-foreground text-background px-4 py-2 rounded-md flex items-center gap-2 hover:bg-foreground/90 font-medium text-sm transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          Create Role
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">Loading roles...</td></tr>
            ) : roles.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">No roles found.</td></tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-foreground">{role.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-muted-foreground">{role.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-md border bg-muted/60 text-foreground border-border">
                      {role.system_role ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-md border ${role.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                      {role.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <Link to={`/roles/${role.id}`} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit Permissions">
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      <button className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="View Users">
                        <Users className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
