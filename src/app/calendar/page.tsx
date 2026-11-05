import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-headline font-semibold md:text-3xl">Academic Calendar</h1>
          <p className="text-muted-foreground">Manage academic events, terms, and important dates.</p>
        </div>
        <Card>
            <CardContent className="p-0 flex justify-center">
                <Calendar
                    mode="single"
                    className="p-3"
                />
            </CardContent>
        </Card>
    </div>
  );
}
