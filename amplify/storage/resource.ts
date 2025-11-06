import { defineStorage } from "@aws-amplify/backend";

export const defaultBucket = defineStorage({
  name: "defaultBucket",
  isDefault: true,
});
