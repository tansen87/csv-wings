import { type VNode } from "vue";
import { isFunction } from "@pureadmin/utils";
import { type MessageHandler, ElMessage } from "element-plus";

type messageTypes = "info" | "success" | "warning" | "error";
type messagePlacement =
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface MessageParams {
  /** 消息类型, 可选 `info` 、`success` 、`warning` 、`error` , 默认 `info` */
  type?: messageTypes;
  /** 自定义图标, 该属性会覆盖 `type` 的图标 */
  icon?: any;
  /** 是否将 `message` 属性作为 `HTML` 片段处理, 默认 `false` */
  dangerouslyUseHTMLString?: boolean;
  /** 显示时间, 单位为毫秒。设为 `0` 则不会自动关闭, 默认是 `5000` */
  duration?: number;
  /** 是否显示关闭按钮, 默认值 `true` */
  showClose?: boolean;
  /** `Message` 距离窗口顶部/底部的偏移量, 默认 `11` */
  offset?: number;
  /** 设置组件的根元素, 默认 `document.body` */
  appendTo?: string | HTMLElement;
  /** 合并内容相同的消息, 不支持 `VNode` 类型的消息, 默认值 `true` */
  grouping?: boolean;
  /** 消息放置位置, 默认值 `bottom-right` */
  placement?: messagePlacement;
  /** 关闭时的回调函数, 参数为被关闭的 `message` 实例 */
  onClose?: Function | null;
}

/**
 * `Message` 消息提示函数
 */
const message = (
  message: string | VNode | (() => VNode),
  params?: MessageParams
): MessageHandler => {
  const {
    icon,
    type = "info",
    dangerouslyUseHTMLString = false,
    duration = 5000,
    showClose = false,
    offset = 11,
    appendTo = document.body,
    grouping = true,
    placement = "bottom-right",
    onClose
  } = params ?? {};

  return ElMessage({
    message,
    type,
    icon,
    dangerouslyUseHTMLString,
    duration,
    showClose,
    offset,
    appendTo,
    grouping,
    placement,
    customClass: "silicone-message",
    onClose: () => (isFunction(onClose) ? onClose() : null)
  });
};

/**
 * 关闭所有 `Message` 消息提示函数
 */
const closeAllMessage = (): void => ElMessage.closeAll();

export { message, closeAllMessage };
