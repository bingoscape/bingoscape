"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getNotifications, markNotificationAsRead } from "@/app/actions/notifications"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"

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

  useEffect(() => {
    // Fetch notifications immediately when component mounts
    fetchNotifications()
      .then(() => console.log("Notifications fetched"))
      .catch((e) => console.error(e))

    // Set up interval to fetch notifications every 10 seconds
    const intervalId = setInterval(() => {
      fetchNotifications()
        .then(() => console.log("Notifications refreshed"))
        .catch((e) => console.error("Error refreshing notifications:", e))
    }, 10000)

    // Clean up interval when component unmounts
    return () => clearInterval(intervalId)
  }, [])

  async function fetchNotifications() {
    const fetchedNotifications = await getNotifications(userId)
    setNotifications(fetchedNotifications)
    setUnreadCount(fetchedNotifications.filter((n) => !n.isRead).length)
  }

  async function handleNotificationClick(notificationId: string) {
    await markNotificationAsRead(notificationId)
    fetchNotifications()
      .then(() => console.log("Notifications fetched"))
      .catch((e) => console.error(e))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="p-4 border-b">
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
                className={`m-2 p-0 border relative ${notification.isRead ? "bg-muted/20" : "bg-background shadow-md border-l-4 border-l-blue-500"
                  }`}
                onClick={() => handleNotificationClick(notification.id)}
              >
                {!notification.isRead && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500"></span>
                )}
                <div className="flex p-3 gap-3">
                  {/* Tile image placeholder */}
                  <div className="w-24 h-24 border border-[#d9d9d9] flex-shrink-0 relative">
                    <Image
                      src={notification.tileImage ?? "/placeholder.svg?width=96&height=96"}
                      alt="Tile"
                      fill
                      sizes="96px"
                      style={{ objectFit: "contain" }}
                      priority={false}
                    />
                  </div>

                  <div className="flex flex-col flex-grow">
                    {/* Title: Event + Tile */}
                    <h5 className={`text-sm ${notification.isRead ? "font-medium" : "font-bold"}`}>
                      {notification.eventTitle}: {notification.tileTitle}
                    </h5>

                    {/* Message */}
                    <p
                      className={`text-sm ${notification.isRead ? "text-muted-foreground" : "text-foreground"} mt-1 mb-2`}
                    >
                      {notification.message}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground mb-2">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/events/${notification.eventId}`}
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNotificationClick(notification.id)
                            .then(() => console.log("Handled notification click"))
                            .catch((e) => console.error(e))

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
