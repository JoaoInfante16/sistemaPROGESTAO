'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/hooks/use-auth';
import { api, type UserProfile } from '@/lib/api';
import { Plus, Loader2, Users, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function UsersPage() {
  const { getToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await api.getUsers(token);
      setUsers(data);
    } catch {
      toast.error('Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    try {
      const token = await getToken();
      const result = await api.createUser(token, { email: newEmail.trim(), is_admin: isAdmin });
      setTempPassword(result.tempPassword);
      await loadUsers();
      toast.success(`${isAdmin ? 'Administrador' : 'Usuario'} criado com sucesso`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setNewEmail('');
    setIsAdmin(false);
    setTempPassword(null);
    setCopied(false);
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const token = await getToken();
      await api.updateUser(token, userId, { active: !currentActive });
      await loadUsers();
      toast.success(`Usuario ${!currentActive ? 'ativado' : 'desativado'}`);
    } catch {
      toast.error('Erro ao atualizar usuario');
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Tem certeza que deseja DELETAR permanentemente o usuario ${email}? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    try {
      const token = await getToken();
      await api.deleteUser(token, userId);
      await loadUsers();
      toast.success('Usuario deletado permanentemente');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); else setCreateOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Novo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {tempPassword ? 'Usuario Criado' : 'Criar Novo Usuario'}
              </DialogTitle>
            </DialogHeader>
            {tempPassword ? (
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Compartilhe a senha temporaria com o usuario. Ele deve altera-la no primeiro login.
                </p>
                <div>
                  <Label>Email</Label>
                  <Input value={newEmail} readOnly />
                </div>
                <div>
                  <Label>Senha Temporaria</Label>
                  <div className="flex gap-2">
                    <Input value={tempPassword} readOnly className="font-mono" />
                    <Button variant="outline" size="icon" onClick={handleCopyPassword}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button onClick={handleCloseCreate} className="w-full">Fechar</Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Email do Usuario</Label>
                  <Input
                    type="email"
                    placeholder="usuario@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isAdmin && handleCreateUser()}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-admin"
                    checked={isAdmin}
                    onCheckedChange={(checked) => setIsAdmin(checked as boolean)}
                  />
                  <Label htmlFor="is-admin" className="cursor-pointer text-sm font-normal">
                    É administrador (acesso ao painel admin)
                  </Label>
                </div>
                <Button onClick={handleCreateUser} disabled={creating} className="w-full">
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar {isAdmin ? 'Administrador' : 'Usuario'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>Nenhum usuario cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead className="w-[120px]">Criado em</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px]">Ativo</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                        {user.is_admin ? 'Admin' : 'Usuario'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? 'default' : 'outline'}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.active}
                        onCheckedChange={() => toggleActive(user.id, user.active)}
                        disabled={user.is_admin}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
