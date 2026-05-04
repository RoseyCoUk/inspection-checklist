export type RoomType = { id: string; name: string };
export type Room = { id: string; number: string; room_type_id: string; active: boolean; room_types?: RoomType };
export type ItemCategory = "paint" | "mechanical" | "plumbing" | "electrical" | "furniture" | "cleaning" | "other" | "wallpaper" | "aluminum" | "hk";
export type ChecklistItem = { id: string; room_type_id: string; label: string; sort_order: number; category: ItemCategory };
export type Report = { id: string; room_id: string; worker_name: string; created_at: string; rooms?: Room };
export type ReportItem = {
  id: string;
  report_id: string;
  checklist_item_id: string;
  status: "good" | "bad";
  note: string | null;
  photo_path: string | null;
  checklist_items?: ChecklistItem;
};
