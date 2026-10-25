import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import type { DesktopConnectionsRegistry } from '@/global'
import type { SessionInfo } from '@/hermes'
import { resolveProfileColor } from '@/lib/profile-color'
import { $connectionsRegistry } from '@/store/connection-registry-state'
import { $profileColors, normalizeProfileKey } from '@/store/profile'

import type { SidebarSessionGroup } from './projects/workspace-groups'

/** A gateway's full profile list. Its profiles get a group even with no
 *  listed sessions: a profile that only runs kanban/cron/subagent work has no
 *  recents, and "all profiles" must still show it (and its + button). */
export interface GatewayProfileRoster {
  connectionId: null | string
  profiles: string[]
}

/** One group per exact owner `[connectionId, profile]`. Group identity never
 *  depends on a mutable label, URL, or the active gateway. */
export function buildGatewaySessionGroups(
  sessions: SessionInfo[],
  registry: DesktopConnectionsRegistry | null,
  colors: Record<string, string>,
  roster?: GatewayProfileRoster | null
): SidebarSessionGroup[] {
  const groups = new Map<string, SidebarSessionGroup>()

  const groupFor = (connectionId: null | string, profile: string): SidebarSessionGroup => {
    const id = JSON.stringify([connectionId, profile])
    const existing = groups.get(id)

    if (existing) {
      return existing
    }

    const gateway = registry?.connections.find(connection => connection.id === connectionId)

    const group: SidebarSessionGroup = {
      id,
      label: connectionId ? `${gateway?.label || connectionId} · ${profile}` : profile,
      connectionId,
      profile,
      mode: 'profile',
      path: null,
      color: resolveProfileColor(profile, colors),
      sessions: []
    }

    groups.set(id, group)

    return group
  }

  for (const session of sessions) {
    groupFor(session.connection_id || null, normalizeProfileKey(session.profile)).sessions.push(session)
  }

  for (const profile of roster?.profiles ?? []) {
    groupFor(roster!.connectionId, normalizeProfileKey(profile))
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}

/** Re-key owner groups shown inside another section (a messaging platform) so
 *  their collapse/alias/order preferences never touch the recents groups. No
 *  gateway header sits above them there, so the gateway stays in the label only
 *  when the section mixes gateways. */
export function scopeGatewaySessionGroups(groups: SidebarSessionGroup[], scope: string): SidebarSessionGroup[] {
  const mixed = new Set(groups.map(group => group.connectionId)).size > 1

  return groups.map(group => ({
    ...group,
    id: JSON.stringify([scope, group.id]),
    label: mixed ? group.label : group.profile!
  }))
}

export function useGatewaySessionGroups(
  sessions: SessionInfo[],
  enabled: boolean,
  roster?: GatewayProfileRoster | null
) {
  const registry = useStore($connectionsRegistry)
  const colors = useStore($profileColors)

  return useMemo(
    () => (enabled ? buildGatewaySessionGroups(sessions, registry, colors, roster) : undefined),
    [sessions, enabled, registry, colors, roster]
  )
}
