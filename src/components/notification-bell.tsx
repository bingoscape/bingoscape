"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getNotifications, markNotificationAsRead } from "@/app/actions/notifications"

interface Notification {
  id: string
  message: string
  isRead: boolean
  createdAt: Date
  eventTitle: string
  teamName: string
  tileTitle: string
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    const fetchedNotifications = await getNotifications(userId)
    setNotifications(fetchedNotifications)
    setUnreadCount(fetchedNotifications.filter((n) => !n.isRead).length)
  }

  async function handleNotificationClick(notificationId: string) {
    await markNotificationAsRead(notificationId)
    fetchNotifications()
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <h4 className="font-medium leading-none">Notifications</h4>
          {notifications.length === 0 ? (
            <p>No notifications</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`text-sm ${notification.isRead ? "text-muted-foreground" : "font-semibold"}`}
                onClick={() => handleNotificationClick(notification.id)}
              >
                <p>{notification.message}</p>
                <p className="text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
