export const CallbackId = {
  MainMenu: "main_menu",
  CreateSemester: "create_semester_modal",
  AddSubject: "add_subject_modal",
  ManageSubject: "manage_subject_modal",
  LogProgress: "log_progress_modal",
  ViewProgress: "view_progress_modal",
  CloseSemester: "close_semester_modal",
  InfoView: "info_view",
  LogProgressStandalone: "log_progress_standalone",
} as const;

export const ActionId = {
  BackToHome: "back_to_home",
} as const;

export const MenuAction = {
  CreateSemester: "create_semester",
  AddSubject: "add_subject",
  ManageSubject: "manage_subject",
  LogProgress: "log_progress",
  ViewProgress: "view_progress",
  CloseSemester: "close_semester",
} as const;
