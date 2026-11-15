const text = "```json\n[{\"title\": \"משימה\"}]\n```";
console.log(text.replace(/```(json)?/g, '').trim());
