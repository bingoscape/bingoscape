"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  getNotifications,
  markNotificationAsRead,
} from "@/app/actions/notifications"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"
import getRandomFrog from "@/lib/getRandomFrog"

interface Notification {
  id: string
  message: string
  isRead: boolean
  createdAt: Date
  eventTitle: string
  eventId: string
  teamName: string
  tileTitle: string
  tileImage: string | null
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  async function fetchNotifications() {
    const fetchedNotifications = await getNotifications(userId)
    setNotifications(fetchedNotifications)
    setUnreadCount(fetchedNotifications.filter((n) => !n.isRead).length)
  }

  useEffect(() => {
    // Fetch notifications immediately when component mounts
    fetchNotifications().catch((e) => console.error(e))

    // Set up interval to fetch notifications every 10 seconds
    const intervalId = setInterval(() => {
      fetchNotifications().catch((e) =>
        console.error("Error refreshing notifications:", e)
      )
    }, 10000)

    // Clean up interval when component unmounts
    return () => clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleNotificationClick(notificationId: string) {
    await markNotificationAsRead(notificationId)
    fetchNotifications().catch((e) => console.error(e))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 inline-flex -translate-y-1/2 translate-x-1/2 transform items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold leading-none text-red-100">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="border-b p-4">
          <h4 className="font-medium">Notifications</h4>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`relative m-2 border p-0 ${
                  notification.isRead
                    ? "bg-muted/20"
                    : "border-l-4 border-l-blue-500 bg-background shadow-md"
                }`}
                onClick={() => handleNotificationClick(notification.id)}
              >
                {!notification.isRead && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-500"></span>
                )}
                <div className="flex gap-3 p-3">
                  {/* Tile image placeholder */}
                  <div className="relative h-24 w-24 shrink-0 border border-[#d9d9d9]">
                    <Image
                      src={notification.tileImage ?? getRandomFrog()}
                      alt="Tile"
                      fill
                      sizes="96px"
                      style={{ objectFit: "contain" }}
                      priority={false}
                    />
                  </div>

                  <div className="flex grow flex-col">
                    {/* Title: Event + Tile */}
                    <h5
                      className={`text-sm ${notification.isRead ? "font-medium" : "font-bold"}`}
                    >
                      {notification.eventTitle}: {notification.tileTitle}
                    </h5>

                    {/* Message */}
                    <p
                      className={`text-sm ${notification.isRead ? "text-muted-foreground" : "text-foreground"} mb-2 mt-1`}
                    >
                      {notification.message}
                    </p>

                    {/* Timestamp */}
                    <p className="mb-2 text-xs text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>

                    {/* Action buttons */}
                    <div
                      className="mt-auto flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={`/events/${notification.eventId}`}
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNotificationClick(notification.id).catch((e) =>
                            console.error(e)
                          )
                        }}
                      >
                        <Button className="w-full" variant="ghost">
                          Event
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
