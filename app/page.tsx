import { ErrorBoundary } from "@/components/common/error-boundary";
import { AppProviders } from "@/components/providers/app-providers";
import { Workbench } from "@/components/workbench/workbench";

/**
 * 唯一的页面：打开就是可编辑状态，没有登录页、项目首页或新手向导（PRD 9.3）。
 */
export default function Page() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <Workbench />
      </AppProviders>
    </ErrorBoundary>
  );
}
