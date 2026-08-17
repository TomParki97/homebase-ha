"""Data models for HomeBase."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from uuid import uuid4


def utc_now() -> datetime:
    """Return the current time in UTC."""
    return datetime.now(timezone.utc)


def datetime_from_storage(value: str | None) -> datetime | None:
    """Convert a stored ISO datetime string back into a datetime."""
    if value is None:
        return None

    return datetime.fromisoformat(value)


class ChoreStatus(StrEnum):
    """Possible states for a HomeBase chore."""

    UPCOMING = "upcoming"
    DUE_TODAY = "due_today"
    OVERDUE = "overdue"
    PAUSED = "paused"


class ScheduleType(StrEnum):
    """Supported chore schedule types."""

    ONE_TIME = "one_time"
    FIXED = "fixed"
    RELATIVE = "relative"


@dataclass
class ChoreCompletion:
    """Represent one completion of a HomeBase chore."""

    completed_at: datetime = field(default_factory=utc_now)
    completed_by: str | None = None
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Convert the completion to JSON-serializable data."""
        return {
            "completed_at": self.completed_at.isoformat(),
            "completed_by": self.completed_by,
            "note": self.note,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ChoreCompletion":
        """Create a completion from stored data."""
        completed_at = datetime_from_storage(data.get("completed_at"))

        return cls(
            completed_at=completed_at or utc_now(),
            completed_by=data.get("completed_by"),
            note=data.get("note", ""),
        )


@dataclass
class Chore:
    """Represent a HomeBase chore."""

    name: str
    description: str = ""
    area: str | None = None
    assignee: str | None = None

    schedule_type: ScheduleType = ScheduleType.ONE_TIME
    due_at: datetime | None = None
    interval_days: int | None = None

    paused: bool = False

    chore_id: str = field(default_factory=lambda: uuid4().hex)
    created_at: datetime = field(default_factory=utc_now)
    last_completed_at: datetime | None = None
    completion_history: list[ChoreCompletion] = field(default_factory=list)

    def complete(
        self,
        completed_by: str | None = None,
        note: str = "",
    ) -> ChoreCompletion:
        """Mark the chore as completed."""
        completion = ChoreCompletion(
            completed_by=completed_by,
            note=note,
        )

        self.last_completed_at = completion.completed_at
        self.completion_history.append(completion)

        return completion

    def to_dict(self) -> dict[str, Any]:
        """Convert the chore to JSON-serializable data."""
        return {
            "chore_id": self.chore_id,
            "name": self.name,
            "description": self.description,
            "area": self.area,
            "assignee": self.assignee,
            "schedule_type": self.schedule_type.value,
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "interval_days": self.interval_days,
            "paused": self.paused,
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
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Chore":
        """Create a chore from stored data."""
        created_at = datetime_from_storage(data.get("created_at"))

        return cls(
            chore_id=data["chore_id"],
            name=data["name"],
            description=data.get("description", ""),
            area=data.get("area"),
            assignee=data.get("assignee"),
            schedule_type=ScheduleType(
                data.get("schedule_type", ScheduleType.ONE_TIME.value)
            ),
            due_at=datetime_from_storage(data.get("due_at")),
            interval_days=data.get("interval_days"),
            paused=data.get("paused", False),
            created_at=created_at or utc_now(),
            last_completed_at=datetime_from_storage(
                data.get("last_completed_at")
            ),
            completion_history=[
                ChoreCompletion.from_dict(completion)
                for completion in data.get("completion_history", [])
            ],
        )
