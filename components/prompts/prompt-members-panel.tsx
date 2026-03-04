"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toaster"

type PromptRole = "OWNER" | "EDITOR" | "REVIEWER" | "VIEWER"

interface PromptMemberItem {
  id: string
  role: PromptRole
  userId: string
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface PromptMembersPanelProps {
  promptId: string
  canManage: boolean
}

const ROLE_LABELS: Record<PromptRole, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
}

export function PromptMembersPanel({ promptId, canManage }: PromptMembersPanelProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<PromptMemberItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newMemberUserId, setNewMemberUserId] = useState("")
  const [newMemberRole, setNewMemberRole] = useState<Exclude<PromptRole, "OWNER">>("VIEWER")

  const fetchMembers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}/members`)
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "加载协作者失败")
      }
      setMembers(payload as PromptMemberItem[])
    } catch (error) {
      toast({
        type: "error",
        title: "加载协作者失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsLoading(false)
    }
  }, [promptId, toast])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  const updateMemberRole = (userId: string, role: Exclude<PromptRole, "OWNER">) => {
    setMembers((prev) =>
      prev.map((item) => (item.userId === userId ? { ...item, role } : item))
    )
  }

  const removeMember = (userId: string) => {
    setMembers((prev) => prev.filter((item) => item.userId !== userId))
  }

  const addMemberDraft = () => {
    const userId = newMemberUserId.trim()
    if (!userId) {
      return
    }

    if (members.some((item) => item.userId === userId)) {
      toast({
        type: "info",
        title: "成员已存在",
      })
      return
    }

    setMembers((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}`,
        userId,
        role: newMemberRole,
        user: {
          id: userId,
          name: null,
          email: userId,
        },
      },
    ])
    setNewMemberUserId("")
  }

  const saveMembers = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}/members`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          members: members
            .filter((item) => item.role !== "OWNER")
            .map((item) => ({
              userId: item.userId,
              role: item.role,
            })),
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "保存协作者失败")
      }

      toast({
        type: "success",
        title: "协作者已更新",
      })

      setMembers(payload as PromptMemberItem[])
    } catch (error) {
      toast({
        type: "error",
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!canManage) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          协作者权限
        </CardTitle>
        <CardDescription>配置 Owner / Editor / Reviewer / Viewer 角色边界。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">正在加载协作者...</p>
        ) : (
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无协作者</p>
            ) : (
              members.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-md border border-border bg-background p-2 sm:grid-cols-[1.5fr_0.9fr_auto] sm:items-center">
                  <p className="text-sm">
                    {item.user.name || item.user.email} <span className="text-xs text-muted-foreground">({item.userId})</span>
                  </p>
                  {item.role === "OWNER" ? (
                    <p className="text-sm font-medium">Owner</p>
                  ) : (
                    <select
                      value={item.role}
                      onChange={(event) =>
                        updateMemberRole(
                          item.userId,
                          event.target.value as Exclude<PromptRole, "OWNER">
                        )
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="REVIEWER">Reviewer</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                  )}
                  {item.role !== "OWNER" ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeMember(item.userId)}>
                      移除
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 sm:grid-cols-[1.3fr_1fr_auto]">
          <Input
            value={newMemberUserId}
            onChange={(event) => setNewMemberUserId(event.target.value)}
            placeholder="输入用户 ID"
            aria-label="新增协作者用户 ID"
          />
          <select
            value={newMemberRole}
            onChange={(event) => setNewMemberRole(event.target.value as Exclude<PromptRole, "OWNER">)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="EDITOR">Editor</option>
            <option value="REVIEWER">Reviewer</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <Button type="button" variant="outline" onClick={addMemberDraft}>添加</Button>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void saveMembers()} disabled={isSaving}>
            {isSaving ? "保存中..." : "保存权限设置"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void fetchMembers()} disabled={isSaving}>
            刷新
          </Button>
        </div>

        <div className="rounded-md border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
          角色说明：{ROLE_LABELS.OWNER} 可管理成员与删除，{ROLE_LABELS.EDITOR} 可编辑与回滚，{ROLE_LABELS.REVIEWER} 可审核发布，{ROLE_LABELS.VIEWER} 仅查看。
        </div>
      </CardContent>
    </Card>
  )
}
