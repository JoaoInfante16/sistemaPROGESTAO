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
import { Plus, Loader2, Users, Copy, Check, Trash2, KeyRound, RefreshCw } from 'lucide-react';
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
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setGeneratedPassword(pw);
    return pw;
  }

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
    if (!newEmail.trim() || !generatedPassword) return;
    setCreating(true);
    try {
      const token = await getToken();
      await api.createUser(token, { email: newEmail.trim(), is_admin: isAdmin, password: generatedPassword });
      setTempPassword(generatedPassword);
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

  const handleOpenCreate = () => {
    setCreateOpen(true);
    setTempPassword(null);
    generatePassword();
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setNewEmail('');
    setIsAdmin(false);
    setTempPassword(null);
    setGeneratedPassword('');
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

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCopied, setResetCopied] = useState(false);

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Redefinir senha de ${email}?`)) return;
    try {
      const token = await getToken();
      const result = await api.resetPassword(token, userId);
      setResetEmail(email);
      setResetPassword(result.tempPassword);
      setResetOpen(true);
      toast.success('Senha redefinida');
    } catch (err) {
      toast.error((err as Error).message);
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
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open) handleCloseCreate(); else handleOpenCreate(); }}>
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
                  />
                </div>
                <div>
                  <Label>Senha temporaria</Label>
                  <div className="flex gap-2">
                    <Input value={generatedPassword} readOnly className="font-mono" />
                    <Button variant="outline" size="icon" onClick={generatePassword} title="Gerar nova senha">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={async () => {
                      await navigator.clipboard.writeText(generatedPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
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
                <Button onClick={handleCreateUser} disabled={creating || !newEmail.trim()} className="w-full">
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Usuario
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
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.email}</span>
                        {user.password_reset_requested && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Pediu reset
                          </Badge>
                        )}
                        {user.must_change_password && !user.password_reset_requested && (
                          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-[10px] px-1.5 py-0">
                            Senha temporaria
                          </Badge>
                        )}
                      </div>
                    </TableCell>
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
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                          onClick={() => handleResetPassword(user.id, user.email)}
                          title="Redefinir senha"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          title="Deletar usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de senha redefinida */}
      <Dialog open={resetOpen} onOpenChange={(open) => { if (!open) { setResetOpen(false); setResetPassword(null); setResetCopied(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha Redefinida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Compartilhe a nova senha temporaria com o usuario.
            </p>
            <div>
              <Label>Email</Label>
              <Input value={resetEmail} readOnly />
            </div>
            <div>
              <Label>Nova Senha Temporaria</Label>
              <div className="flex gap-2">
                <Input value={resetPassword || ''} readOnly className="font-mono" />
                <Button variant="outline" size="icon" onClick={async () => {
                  if (resetPassword) {
                    await navigator.clipboard.writeText(resetPassword);
                    setResetCopied(true);
                    setTimeout(() => setResetCopied(false), 2000);
                  }
                }}>
                  {resetCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button onClick={() => { setResetOpen(false); setResetPassword(null); setResetCopied(false); }} className="w-full">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
