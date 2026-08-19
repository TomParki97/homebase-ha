"""Maintenance data models for HomeBase."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4


def utc_now() -> datetime:
    """Return the current time in UTC."""
    return datetime.now(timezone.utc)


def datetime_from_storage(
    value: str | None,
) -> datetime | None:
    """Convert a stored ISO datetime back into a datetime."""
    if value is None:
        return None

    return datetime.fromisoformat(value)


class MaintenanceStatus(StrEnum):
    """Possible states for a HomeBase maintenance item."""

    UPCOMING = "upcoming"
    DUE_TODAY = "due_today"
    OVERDUE = "overdue"
    PAUSED = "paused"
    COMPLETED = "completed"


class MaintenanceScheduleType(StrEnum):
    """Supported maintenance schedule types."""

    ONE_TIME = "one_time"
    FIXED = "fixed"
    RELATIVE = "relative"


@dataclass
class MaintenanceCompletion:
    """Represent one maintenance completion."""

    completed_at: datetime = field(default_factory=utc_now)
    completed_by: str | None = None
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert the completion to serializable data."""
        return {
            "completed_at": self.completed_at.isoformat(),
            "completed_by": self.completed_by,
            "note": self.note,
        }

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
    ) -> "MaintenanceCompletion":
        """Create a completion from stored data."""
        completed_at = datetime_from_storage(
            data.get("completed_at")
        )

        return cls(
            completed_at=completed_at or utc_now(),
            completed_by=data.get("completed_by"),
            note=data.get("note", ""),
        )


@dataclass
class MaintenanceItem:
    """Represent a HomeBase maintenance item."""

    name: str
    description: str = ""
    area: str | None = None
    asset: str | None = None
    assignee: str | None = None

    schedule_type: MaintenanceScheduleType = (
        MaintenanceScheduleType.ONE_TIME
    )
    due_at: datetime | None = None
    interval_days: int | None = None

    paused: bool = False
    completed: bool = False

    maintenance_id: str = field(
        default_factory=lambda: uuid4().hex
    )
    created_at: datetime = field(default_factory=utc_now)
    last_completed_at: datetime | None = None
    completion_history: list[MaintenanceCompletion] = field(
        default_factory=list
    )

    due_reminder_sent_for: datetime | None = None
    overdue_reminder_sent_for: datetime | None = None

    def status_at(
        self,
        now: datetime,
    ) -> MaintenanceStatus:
        """Return the maintenance status at a specific time."""
        if self.paused:
            return MaintenanceStatus.PAUSED

        if self.completed:
            return MaintenanceStatus.COMPLETED

        if self.due_at is None:
            return MaintenanceStatus.UPCOMING

        if now.tzinfo is None:
            raise ValueError(
                "Status time must be timezone-aware"
            )

        due_at = self.due_at

        if due_at.tzinfo is None:
            due_at = due_at.replace(
                tzinfo=timezone.utc
            )

        due_local = due_at.astimezone(now.tzinfo)

        if due_local.date() < now.date():
            return MaintenanceStatus.OVERDUE

        if due_local.date() == now.date():
            return MaintenanceStatus.DUE_TODAY

        return MaintenanceStatus.UPCOMING

    def complete(
        self,
        completed_by: str | None = None,
        note: str = "",
    ) -> MaintenanceCompletion:
        """Complete this maintenance occurrence."""
        completion = MaintenanceCompletion(
            completed_by=completed_by,
            note=note,
        )

        self.last_completed_at = completion.completed_at
        self.completion_history.append(completion)

        if (
            self.schedule_type
            == MaintenanceScheduleType.ONE_TIME
        ):
            self.completed = True

        elif (
            self.schedule_type
            == MaintenanceScheduleType.RELATIVE
            and self.interval_days is not None
            and self.interval_days > 0
        ):
            self.completed = False
            self.due_at = (
                completion.completed_at
                + timedelta(days=self.interval_days)
            )

        elif (
            self.schedule_type
            == MaintenanceScheduleType.FIXED
            and self.interval_days is not None
            and self.interval_days > 0
        ):
            self.completed = False
            interval = timedelta(
                days=self.interval_days
            )

            if self.due_at is None:
                self.due_at = (
                    completion.completed_at + interval
                )
            else:
                next_due = self.due_at + interval

                while next_due <= completion.completed_at:
                    next_due += interval

                self.due_at = next_due

        return completion

    def to_dict(self) -> dict[str, Any]:
        """Convert the maintenance item to serializable data."""
        return {
            "maintenance_id": self.maintenance_id,
            "name": self.name,
            "description": self.description,
            "area": self.area,
            "asset": self.asset,
            "assignee": self.assignee,
            "schedule_type": self.schedule_type.value,
            "due_at": (
                self.due_at.isoformat()
                if self.due_at
                else None
            ),
            "interval_days": self.interval_days,
            "paused": self.paused,
            "completed": self.completed,
            "created_at": self.created_at.isoformat(),
            "last_completed_at": (
                self.last_completed_at.isoformat()
                if self.last_completed_at
                else None
            ),
            "completion_history": [
                completion.to_dict()
                for completion in self.completion_history
            ],
            "due_reminder_sent_for": (
                self.due_reminder_sent_for.isoformat()
                if self.due_reminder_sent_for
                else None
            ),
            "overdue_reminder_sent_for": (
                self.overdue_reminder_sent_for.isoformat()
                if self.overdue_reminder_sent_for
                else None
            ),
        }

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any],
    ) -> "MaintenanceItem":
        """Create a maintenance item from stored data."""
        schedule_type = MaintenanceScheduleType(
            data.get(
                "schedule_type",
                MaintenanceScheduleType.ONE_TIME.value,
            )
        )

        created_at = datetime_from_storage(
            data.get("created_at")
        )

        last_completed_at = datetime_from_storage(
            data.get("last_completed_at")
        )

        completed = data.get("completed")

        if completed is None:
            completed = (
                schedule_type
                == MaintenanceScheduleType.ONE_TIME
                and last_completed_at is not None
            )

        return cls(
            maintenance_id=data["maintenance_id"],
            name=data["name"],
            description=data.get("description", ""),
            area=data.get("area"),
            asset=data.get("asset"),
            assignee=data.get("assignee"),
            schedule_type=schedule_type,
            due_at=datetime_from_storage(
                data.get("due_at")
            ),
            interval_days=data.get("interval_days"),
            paused=data.get("paused", False),
            completed=completed,
            created_at=created_at or utc_now(),
            last_completed_at=last_completed_at,
            completion_history=[
                MaintenanceCompletion.from_dict(
                    completion
                )
                for completion
                in data.get("completion_history", [])
            ],
            due_reminder_sent_for=datetime_from_storage(
                data.get("due_reminder_sent_for")
            ),
            overdue_reminder_sent_for=datetime_from_storage(
                data.get("overdue_reminder_sent_for")
            ),
        )
