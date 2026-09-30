package dev.nova.academics.resource;

import dev.nova.academics.course.Course;
import dev.nova.academics.course.CourseRepository;
import dev.nova.academics.resource.CourseResourceDtos.ResourceRequest;
import dev.nova.academics.resource.CourseResourceDtos.ResourceResponse;
import dev.nova.common.web.ApiException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A course's links, oldest first (the order they were added). */
@Service
public class CourseResourceService {

    static final int MAX_PER_COURSE = 50;

    private final CourseResourceRepository resources;
    private final CourseRepository courses;

    public CourseResourceService(CourseResourceRepository resources, CourseRepository courses) {
        this.resources = resources;
        this.courses = courses;
    }

    @Transactional(readOnly = true)
    public List<ResourceResponse> list(UUID userId, UUID courseId) {
        Course course = requireCourse(userId, courseId);
        return resources.findByCourseIdAndUserIdOrderByCreatedAtAscIdAsc(course.getId(), userId).stream()
                .map(ResourceResponse::from)
                .toList();
    }

    @Transactional
    public ResourceResponse add(UUID userId, UUID courseId, ResourceRequest request) {
        Course course = requireCourse(userId, courseId);
        if (resources.countByCourseId(course.getId()) >= MAX_PER_COURSE) {
            throw ApiException.ruleViolation("url", "A course can have up to " + MAX_PER_COURSE + " links.");
        }
        CourseResource resource = new CourseResource(userId, course.getId(), request.title().strip(), url(request));
        return ResourceResponse.from(resources.saveAndFlush(resource));
    }

    @Transactional
    public ResourceResponse update(UUID userId, UUID courseId, UUID resourceId, ResourceRequest request) {
        CourseResource resource = require(userId, courseId, resourceId);
        resource.edit(request.title().strip(), url(request));
        resources.flush();
        return ResourceResponse.from(resource);
    }

    @Transactional
    public void delete(UUID userId, UUID courseId, UUID resourceId) {
        resources.delete(require(userId, courseId, resourceId));
    }

    private static String url(ResourceRequest request) {
        return WebLinks.normalize(request.url())
                .orElseThrow(() -> ApiException.invalidField("url", "Use a web link starting with http:// or https://."));
    }

    private Course requireCourse(UUID userId, UUID courseId) {
        return courses.findByIdAndUserId(courseId, userId).orElseThrow(ApiException::notFound);
    }

    private CourseResource require(UUID userId, UUID courseId, UUID resourceId) {
        return resources.findByIdAndCourseIdAndUserId(resourceId, courseId, userId).orElseThrow(ApiException::notFound);
    }
}
