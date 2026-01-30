'use client';

import React from 'react';
import NewCourseForm from '@/components/courses/NewCourseForm';



export default function NewCoursePage() {
    return (
        <div className="flex-1 overflow-auto bg-bb-dark">
            <NewCourseForm />
        </div>
    );
}
