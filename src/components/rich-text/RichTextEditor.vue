<script setup lang="ts">
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from 'lucide-vue-next'
import { onBeforeUnmount, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { cn } from '@/composables/utils'

const model = defineModel<string>({ default: '' })

const editor = useEditor({
  content: model.value,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
  ],
  editorProps: {
    attributes: {
      class: 'rich-text-editor-body min-h-[360px] px-3 py-2 focus:outline-none text-sm leading-relaxed',
    },
  },
  onUpdate: ({ editor: ed }) => {
    model.value = ed.getHTML()
  },
})

watch(
  () => model.value,
  (val) => {
    const ed = editor.value
    if (!ed) return
    if (ed.getHTML() !== val) {
      ed.commands.setContent(val || '<p></p>', { emitUpdate: false })
    }
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

function toggleH2() {
  editor.value?.chain().focus().toggleHeading({ level: 2 }).run()
}

function toggleH3() {
  editor.value?.chain().focus().toggleHeading({ level: 3 }).run()
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

function setLink() {
  const ed = editor.value
  if (!ed) return
  const prev = ed.getAttributes('link').href as string | undefined
  const url = window.prompt('URL del enlace', prev ?? 'https://')
  if (url === null) return
  if (url === '') {
    ed.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}
</script>

<template>
  <div class="overflow-hidden rounded-md border border-input bg-background">
    <div v-if="editor" class="flex flex-wrap gap-1 border-b border-input bg-muted/40 p-2">
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('bold') && 'bg-muted')" @click="toggleBold">
        <Bold class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('italic') && 'bg-muted')" @click="toggleItalic">
        <Italic class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('heading', { level: 2 }) && 'bg-muted')" @click="toggleH2">
        <Heading2 class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('heading', { level: 3 }) && 'bg-muted')" @click="toggleH3">
        <Heading3 class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('bulletList') && 'bg-muted')" @click="toggleBulletList">
        <List class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('orderedList') && 'bg-muted')" @click="toggleOrderedList">
        <ListOrdered class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :class="cn(editor.isActive('link') && 'bg-muted')" @click="setLink">
        <LinkIcon class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :disabled="!editor.can().chain().focus().undo().run()" @click="editor.chain().focus().undo().run()">
        <Undo2 class="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" :disabled="!editor.can().chain().focus().redo().run()" @click="editor.chain().focus().redo().run()">
        <Redo2 class="h-4 w-4" />
      </Button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style>
.ProseMirror:focus {
  outline: none;
}
.rich-text-editor-body h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}
.rich-text-editor-body h3 {
  font-weight: 600;
  margin-bottom: 0.5rem;
}
.rich-text-editor-body p {
  margin-bottom: 0.75rem;
}
.rich-text-editor-body ul {
  list-style: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.rich-text-editor-body ol {
  list-style: decimal;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
</style>
